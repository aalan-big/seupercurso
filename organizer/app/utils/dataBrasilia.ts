// Datas de venda do lote no horario de Brasilia. Antes o formulario mandava so
// o dia ("2026-10-28"), que virava meia-noite UTC = 21h do dia anterior aqui:
// o lote abria e fechava 3h antes do que o organizador via na tela.
//
// Brasil sem horario de verao desde 2019: o fuso de Brasilia e fixo em -03:00.
const FUSO_BRASILIA = 'America/Sao_Paulo'
const OFFSET_BRASILIA = '-03:00'

/** ISO do servidor -> { data: 'AAAA-MM-DD', hora: 'HH:mm' } no horario de Brasilia. */
export function paraCamposBrasilia(iso: string): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(iso))
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '00'
  return { data: `${p('year')}-${p('month')}-${p('day')}`, hora: `${p('hour')}:${p('minute')}` }
}

/**
 * Dia + hora digitados (Brasilia) -> ISO com fuso, que o servidor grava sem
 * reinterpretar. `fim` fecha o minuto inteiro (23:59 vale ate 23:59:59).
 */
export function deCamposBrasilia(data: string, hora: string, fim = false): string {
  return `${data}T${hora || (fim ? '23:59' : '00:00')}:${fim ? '59' : '00'}${OFFSET_BRASILIA}`
}

/** "27/10/2026 às 21:00" no horario de Brasilia. */
export function formatarDataHoraBrasilia(iso: string): string {
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO_BRASILIA })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO_BRASILIA })
  return `${data} às ${hora}`
}
