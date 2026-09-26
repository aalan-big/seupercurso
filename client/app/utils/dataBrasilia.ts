// Abertura de vendas sempre no horario de Brasilia, de qualquer lugar que a
// pessoa esteja vendo o site.
const FUSO_BRASILIA = 'America/Sao_Paulo'

/** "01/10/2026 às 10:00" */
export function formatarDataHoraBrasilia(iso: string | Date): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO_BRASILIA })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_BRASILIA })
  return `${data} às ${hora}`
}

/** "01/10 às 10:00", para o card */
export function formatarDataHoraCurtaBrasilia(iso: string | Date): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO_BRASILIA })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_BRASILIA })
  return `${data} às ${hora}`
}
