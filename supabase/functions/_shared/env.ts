const WOMPI_SANDBOX = 'https://sandbox.wompi.co/v1'
const WOMPI_PROD = 'https://production.wompi.co/v1'

export function getWompiBase(): string {
  const prod = Deno.env.get('WOMPI_PRODUCTION')
  if (prod === 'true') return WOMPI_PROD
  if (prod === 'false') return WOMPI_SANDBOX
  throw new Error('WOMPI_PRODUCTION must be set to "true" or "false"')
}

export function isSandbox(): boolean {
  return getWompiBase() === WOMPI_SANDBOX
}
