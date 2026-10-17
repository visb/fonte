type ApiError = { response?: { status?: number; data?: { message?: string | string[] } } };

/** O erro da API é um 404 (recurso não existe mais). */
export function isNotFoundError(error: unknown): boolean {
  return (error as ApiError)?.response?.status === 404;
}

export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  const apiError = error as ApiError;
  const message = apiError?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}
