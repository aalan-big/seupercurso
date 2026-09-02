export interface ResumoEventoFinanceiro {
  eventoId: string
  nome: string
  quantidadePagamentos: number
  totalArrecadado: number
  comissaoPlataforma: number
  repasse: number
}

export interface FinanceiroOrganizador {
  comissaoPercentual: number
  totalArrecadado: number
  comissaoPlataforma: number
  totalRepasse: number
  /** Soma dos saques ja solicitados (processando + concluidos). */
  totalSacado: number
  /** Repasse ainda disponivel para saque: totalRepasse - totalSacado. */
  saldoDisponivel: number
  porEvento: ResumoEventoFinanceiro[]
}

export function useFinanceiroOrganizador() {
  const api = useApi()

  async function buscar() {
    return api<FinanceiroOrganizador>('/organizadores/me/financeiro')
  }

  return { buscar }
}
