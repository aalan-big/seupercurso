export function urlFoto(caminho: string | null | undefined, apiBase: string): string | null {
  if (!caminho) return null
  if (caminho.startsWith('http')) {
    if (import.meta.client && window.location.hostname && caminho.includes('localhost')) {
      return caminho.replace('localhost', window.location.hostname)
    }
    return caminho
  }

  let base = apiBase || 'http://localhost:3000'
  if (import.meta.client && window.location.hostname && base.includes('localhost')) {
    base = base.replace('localhost', window.location.hostname)
  }

  return `${base}${caminho}`
}

