import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { StorageService } from '../modules/storage/storage.service';

// Backfills 70x70 thumbnails for residents that already have a photo but no
// thumbnail (rows created before the thumbnail feature). Safe to re-run: it
// only touches residents where photo_thumb_url is NULL.
//
// Usage (from services/api): pnpm backfill:resident-thumbs

const THUMB_SIZE = 70;

const ds = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

// StorageService reads its config straight from env via ConfigService.get().
const storage = new StorageService({
  get: (key: string) => process.env[key],
} as unknown as ConfigService);

async function makeThumbnail(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function run() {
  await ds.initialize();

  const rows: Array<{ id: string; photo_url: string }> = await ds.query(
    `SELECT id, photo_url FROM residents
     WHERE photo_url IS NOT NULL AND photo_thumb_url IS NULL AND deleted_at IS NULL`,
  );

  console.log(`Encontrados ${rows.length} interno(s) com foto sem thumbnail.`);

  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const original = await storage.download(row.photo_url);
      const thumbBuffer = await makeThumbnail(original);
      const thumbFilename = storage.uniqueFilename('thumb.jpg', 'thumb_');
      const thumbUrl = await storage.upload('residents', thumbFilename, thumbBuffer, 'image/jpeg');
      await ds.query('UPDATE residents SET photo_thumb_url = $1 WHERE id = $2', [thumbUrl, row.id]);
      ok++;
      console.log(`✓ ${row.id} → ${thumbUrl}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${row.id}: ${(err as Error).message}`);
    }
  }

  console.log(`\nConcluído. ${ok} gerado(s), ${failed} falha(s).`);
  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
