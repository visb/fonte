import "reflect-metadata";
import { types } from "pg";
// TIMESTAMP WITHOUT TIME ZONE (OID 1114) — pg lê como string local; forçar UTC
types.setTypeParser(1114, (val: string) => new Date(val + "Z"));
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import { json, urlencoded } from "express";
import { join } from "path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // Limit elevado para suportar conteúdo rico em templates
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  app.enableCors();

  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (!process.env.STORAGE_BUCKET_NAME) {
    app.useStaticAssets(join(process.cwd(), "uploads"), { prefix: "/uploads" });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
