import type { PagamentoDaInscricao } from './useInscricao'

export function usePagamento() {
  const api = useApi()

  async function criar(inscricaoId: string, metodo: string) {
    return api<PagamentoDaInscricao>('/pagamentos', { method: 'POST', body: { inscricaoId, metodo } })
  }

  async function simularAprovacao(pagamentoId: string) {
    return api<PagamentoDaInscricao>(`/pagamentos/${pagamentoId}/simular-aprovacao`, { method: 'POST' })
  }

  async function simularRecusa(pagamentoId: string) {
    return api<PagamentoDaInscricao>(`/pagamentos/${pagamentoId}/simular-recusa`, { method: 'POST' })
  }

  return { criar, simularAprovacao, simularRecusa }
}
