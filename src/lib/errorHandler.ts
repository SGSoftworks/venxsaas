export function parseError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    if (typeof obj.error === 'string') return obj.error
    if (typeof obj.error_description === 'string') return obj.error_description
  }
  return 'Error desconocido'
}

export function getErrorMessage(error: unknown, fallback = 'Error inesperado'): string {
  return parseError(error) || fallback
}
