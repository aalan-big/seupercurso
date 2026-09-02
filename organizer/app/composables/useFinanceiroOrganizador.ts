export interface ResumoEventoFinanceiro {
  eventoId: string
  nome: string
  quantidadePagamentos: number
  totalArrecadado: number
  comissaoPlataforma: number
  /** Tarifa do gateway descontada antes da divisao. */
  taxaGateway: number
  repasse: number
}

export interface FinanceiroOrganizador {
  comissaoPercentual: number
  totalArrecadado: number
  comissaoPlataforma: number
  /** Tarifas do gateway, ja embutidas no valor pago pelo atleta. */
  totalTaxaGateway: number
  totalRepasse: number
  /** false enquanto o organizador nao autorizar a conta no Mercado Pago. */
  contaConectada: boolean
  conectadoEm: string | null
  /** O que impede as vendas agora, ou null quando esta tudo certo. */
  pendencia: string | null
  porEvento: ResumoEventoFinanceiro[]
}

export function useFinanceiroOrganizador() {
  const api = useApi()

  async function buscar() {
    return api<FinanceiroOrganizador>('/organizadores/me/financeiro')
  }

  return { buscar }
}
