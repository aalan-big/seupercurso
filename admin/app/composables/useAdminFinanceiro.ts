export interface ResumoEventoFinanceiro {
  eventoId: string
  nome: string
  quantidadePagamentos: number
  totalArrecadado: number
  comissaoPlataforma: number
  repasse: number
}

export interface ResumoOrganizadorFinanceiro {
  organizadorId: string
  nome: string
  quantidadePagamentos: number
  totalArrecadado: number
  comissaoPlataforma: number
  repasse: number
  eventos: ResumoEventoFinanceiro[]
}

export interface FinanceiroAdmin {
  totalArrecadado: number
  comissaoPlataforma: number
  totalRepasse: number
  porOrganizador: ResumoOrganizadorFinanceiro[]
}

export function useAdminFinanceiro() {
  const api = useApi()

  async function buscar() {
    return api<FinanceiroAdmin>('/admin/financeiro')
  }

  return { buscar }
}
