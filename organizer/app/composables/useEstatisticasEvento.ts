export interface ContagemGenero {
  MASCULINO: number
  FEMININO: number
  OUTRO: number
  NAO_INFORMADO: number
}

export interface EstatisticasEvento {
  evento: {
    id: string
    nome: string
    status: string
    dataInicio: string
    cidade: string
    estado: string
    capacidade: number | null
  }
  modalidadesDisponiveis: { id: string; nome: string }[]
  filtro: { incluirPendentes: boolean; modalidadeId: string | null }
  resumo: {
    confirmadas: number
    pendentes: number
    canceladas: number
    kitsEntregues: number
  }
  total: number
  genero: ContagemGenero
  modalidades: ({ id: string; nome: string; total: number } & ContagemGenero)[]
  idade: {
    faixas: ({ faixa: string; total: number } & ContagemGenero)[]
    media: number | null
    maisNovo: number | null
    maisVelho: number | null
    semIdade: number
  }
  publicos: {
    idosos: number
    descontoIdoso: number
    pcd: number
    descontoPcd: number
    servidorPublico: number
    funcionario: number
    cupom: number
  }
  origem: {
    cidades: { cidade: string; estado: string; total: number }[]
    outrasCidades: number
    totalCidades: number
    estados: { estado: string; total: number }[]
    semEndereco: number
  }
  inscricoesPorDia: { data: string; quantidade: number }[]
}

export function useEstatisticasEvento() {
  const api = useApi()

  async function buscar(
    eventoId: string,
    filtro: { incluirPendentes?: boolean; modalidadeId?: string } = {}
  ) {
    const params = new URLSearchParams()
    if (filtro.incluirPendentes) params.set('incluirPendentes', 'true')
    if (filtro.modalidadeId) params.set('modalidadeId', filtro.modalidadeId)
    const query = params.toString()
    return api<EstatisticasEvento>(
      `/organizadores/me/eventos/${eventoId}/estatisticas${query ? `?${query}` : ''}`
    )
  }

  return { buscar }
}
