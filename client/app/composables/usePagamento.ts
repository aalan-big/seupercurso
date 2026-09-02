import type { PagamentoDaInscricao } from './useInscricao'

export interface StatusPagamento {
  id: string
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO' | 'ESTORNADO' | 'CANCELADO' | 'EXPIRADO'
  metodo: string
  valor: string
  expiraEm?: string | null
  dataPagamento?: string | null
  pixCopiaECola?: string | null
  pixQrCodeUrl?: string | null
}

export function usePagamento() {
  const api = useApi()

  async function criar(inscricaoId: string, metodo: string) {
    return api<PagamentoDaInscricao>('/pagamentos', { method: 'POST', body: { inscricaoId, metodo } })
  }

  /**
   * Consulta o status da cobranca. O backend reconcilia com o Asaas quando o
   * pagamento ainda esta pendente, entao serve para acompanhar o PIX em tempo real.
   */
  async function consultarStatus(pagamentoId: string) {
    return api<StatusPagamento>(`/pagamentos/${pagamentoId}/status`)
  }

  return { criar, consultarStatus }
}
