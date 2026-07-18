import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from './user-preference.entity';

@Injectable()
export class PreferenceService {
  constructor(
    @InjectRepository(UserPreference)
    private repo: Repository<UserPreference>,
  ) {}

  /**
   * Todas as preferências do usuário como mapa chave→valor — o formato que vai
   * direto para o `localStorage` do cliente. Escopo sempre pelo `userId` do
   * token (decisão 3): um usuário nunca enxerga as preferências de outro.
   */
  async getAll(userId: string): Promise<Record<string, unknown>> {
    const rows = await this.repo.find({ where: { userId } });
    const map: Record<string, unknown> = {};
    for (const row of rows) map[row.key] = row.value;
    return map;
  }

  /**
   * Cria ou atualiza a preferência `(userId, key)` — upsert idempotente via
   * `ON CONFLICT (user_id, key) DO UPDATE`. A segunda gravação da mesma chave
   * atualiza sem duplicar.
   */
  async set(userId: string, key: string, value: unknown): Promise<void> {
    // `value` é JSON livre (coluna jsonb tipada como `unknown`); o upsert do
    // TypeORM não aceita `unknown` no partial, daí o cast para o tipo do método.
    const row = { userId, key, value } as unknown as Parameters<
      Repository<UserPreference>['upsert']
    >[0];
    await this.repo.upsert(row, { conflictPaths: ['userId', 'key'] });
  }

  /** Remove a preferência (reset ao padrão). Idempotente: remover inexistente não estoura. */
  async remove(userId: string, key: string): Promise<void> {
    await this.repo.delete({ userId, key });
  }
}
