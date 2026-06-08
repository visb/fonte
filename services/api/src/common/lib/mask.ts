// LGPD — minimização de dados pessoais sensíveis em respostas HTTP.
// CPF/RG só aparecem completos no detalhe para ADMIN/COORDINATOR; em qualquer
// listagem (e para SERVANT) são mascarados. Ver SensitiveDataInterceptor.

// "12345678900" → "***.***.789-00". Mantém apenas os dígitos finais, suficientes
// para conferência visual sem expor o documento inteiro.
export function maskCpf(cpf: string | null | undefined): string | null | undefined {
  if (cpf === null || cpf === undefined) return cpf;
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return '***';
  return `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Mantém apenas os 2 últimos caracteres do RG.
export function maskRg(rg: string | null | undefined): string | null | undefined {
  if (rg === null || rg === undefined) return rg;
  const value = String(rg).trim();
  if (value.length <= 2) return '***';
  return `***${value.slice(-2)}`;
}

const SENSITIVE_KEYS: Record<string, (v: any) => unknown> = {
  cpf: maskCpf,
  rg: maskRg,
};

// Percorre o grafo da resposta mascarando, in-place, as chaves sensíveis.
// Guarda contra ciclos e limita profundidade — entidades TypeORM não trazem
// relações lazy (eager:false), mas a proteção evita loops em refs cruzadas.
export function maskSensitiveFields(payload: unknown, depth = 0, seen = new WeakSet<object>()): void {
  if (depth > 6 || payload === null || typeof payload !== 'object') return;
  if (seen.has(payload as object)) return;
  seen.add(payload as object);

  if (Array.isArray(payload)) {
    for (const item of payload) maskSensitiveFields(item, depth + 1, seen);
    return;
  }

  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    const masker = SENSITIVE_KEYS[key];
    if (masker && (value === null || typeof value === 'string')) {
      (payload as Record<string, unknown>)[key] = masker(value);
    } else if (value && typeof value === 'object') {
      maskSensitiveFields(value, depth + 1, seen);
    }
  }
}
