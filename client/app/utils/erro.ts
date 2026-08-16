export function extrairErro(e: unknown): string {
  const err = e as { data?: { message?: string | string[] }; message?: string }

  const msg = err?.data?.message
  if (Array.isArray(msg)) return msg.join(', ')
  if (msg) return msg

  if (err?.message?.includes('fetch failed') || err?.message?.includes('ECONNREFUSED')) {
    return 'Não foi possível conectar ao servidor. Ele está rodando (npm run dev:server)?'
  }

  return err?.message || 'Erro inesperado.'
}
