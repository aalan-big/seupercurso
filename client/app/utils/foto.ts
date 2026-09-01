export function urlFoto(caminho: string | null | undefined, apiBase: string): string | null {
  if (!caminho) return null
  if (caminho.startsWith('http')) {
    if (import.meta.client && window.location.hostname && caminho.includes('localhost')) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return caminho.replace('localhost', window.location.hostname)
      } else {
        return caminho.replace(/http:\/\/localhost:3000/, window.location.origin)
      }
    }
    return caminho
  }

  let base = apiBase || 'http://localhost:3000'
  if (import.meta.client && window.location.hostname) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      base = base.replace('localhost', window.location.hostname)
    } else {
      base = window.location.origin
    }
  }

  return `${base}${caminho}`
}

