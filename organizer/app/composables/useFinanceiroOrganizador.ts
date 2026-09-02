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
  totalRepasse: number
  /** Tarifas do gateway ja descontadas antes da divisao do split. */
  totalTaxaGateway: number
  /** Soma dos saques ja solicitados (processando + concluidos). */
  totalSacado: number
  /** Saldo real na subconta Asaas; null quando a subconta ainda nao existe. */
  saldoAsaas: number | null
  /** O que pode ser sacado agora (espelha saldoAsaas). */
  saldoDisponivel: number
  /** false enquanto a subconta do organizador nao estiver criada. */
  subcontaAtiva: boolean
  /** Situacao da analise da subconta no Asaas; null quando nao ha subconta. */
  statusSubconta: {
    geral: string | null
    documentacao: string | null
    dadosComerciais: string | null
    dadosBancarios: string | null
  } | null
  /** Motivo que impede o saque agora, ou null quando esta liberado. */
  bloqueioSaque: string | null
  porEvento: ResumoEventoFinanceiro[]
}

export function useFinanceiroOrganizador() {
  const api = useApi()

  async function buscar() {
    return api<FinanceiroOrganizador>('/organizadores/me/financeiro')
  }

  return { buscar }
}
