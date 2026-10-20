function checkDigit(digits: number[]): number {
  const length = digits.length;
  const sum = digits.reduce((acc, digit, i) => acc + digit * (length + 1 - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/**
 * Story 219 — CPF válido (DV correto) e aleatório, só dígitos. O CPF do filho é
 * único entre filhos não excluídos: fixture com CPF fixo colidiria entre
 * execuções (e2e idempotente, story 182).
 */
export function randomCpf(): string {
  let base: number[];
  do {
    base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  } while (base.every((d) => d === base[0]));
  const first = checkDigit(base);
  return [...base, first, checkDigit([...base, first])].join('');
}
