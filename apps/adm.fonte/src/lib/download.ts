/**
 * Dispara o download de um `Blob` no navegador.
 *
 * Extraído do `useChargeReceipt` (story 178) quando o segundo recibo chegou
 * (story 193): dois hooks precisando do mesmo `<a download>` é a deixa para o
 * helper subir para `lib/`, não para copiar oito linhas. A URL do objeto é
 * revogada sempre — sem isso o blob do PDF fica na memória da aba até o reload.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
