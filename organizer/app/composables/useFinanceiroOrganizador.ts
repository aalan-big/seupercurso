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

export interface RelatorioFinanceiroEvento {
  geradoEm: string
  organizador: string
  comissaoPercentual: number
  evento: {
    id: string
    nome: string
    dataInicio: string
    local: string
    cidade: string
    estado: string
  }
  resumo: {
    quantidadePagamentos: number
    totalArrecadado: number
    taxaGateway: number
    comissaoPlataforma: number
    repasse: number
    inscricoesConfirmadas: number
  }
  porForma: Array<{ metodo: string; quantidade: number; totalArrecadado: number; repasse: number }>
  porModalidade: Array<{ modalidade: string; confirmadas: number; importadas: number }>
  pagamentos: Array<{
    id: string
    data: string
    comprador: string
    atletas: string[]
    modalidades: string[]
    metodo: string
    valor: number
    taxaGateway: number
    comissaoPlataforma: number
    repasse: number
  }>
}

export function useFinanceiroOrganizador() {
  const api = useApi()

  async function buscar() {
    return api<FinanceiroOrganizador>('/organizadores/me/financeiro')
  }

  async function relatorioEvento(eventoId: string) {
    return api<RelatorioFinanceiroEvento>(
      `/organizadores/me/financeiro/eventos/${eventoId}/relatorio`,
    )
  }

  return { buscar, relatorioEvento }
}
