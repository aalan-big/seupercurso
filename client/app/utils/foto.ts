export function urlFoto(caminho: string | null | undefined, apiBase: string): string | null {
  if (!caminho) return null
  return `${apiBase}${caminho}`
}
