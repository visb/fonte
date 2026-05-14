type ApiError = { response?: { data?: { message?: string | string[]; error?: string } } };

export function getErrorMessage(error: unknown, fallback = 'Ocorreu um erro inesperado.'): string {
  const apiError = error as ApiError;
  const message = apiError?.response?.data?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message ?? fallback;
}

export function getApiErrorCode(error: unknown): string | undefined {
  const apiError = error as ApiError;
  return apiError?.response?.data?.error;
}
