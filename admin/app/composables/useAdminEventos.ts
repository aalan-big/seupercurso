export interface EventoAdmin {
  id: string
  nome: string
  descricao: string | null
  regulamentoUrl: string | null
  bannerUrl: string | null
  termoResponsabilidade: string | null
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  capacidade: number | null
  status: 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'PUBLICADO' | 'INSCRICOES_ENCERRADAS' | 'CANCELADO' | 'FINALIZADO' | 'SUSPENSO'
  motivoRejeicao: string | null
  permiteServidorPublico?: boolean
  vagasServidorPublico?: number | null
  limiteCupons?: number
  usosPorCupom?: number
  permiteFuncionarios?: boolean
  percentualFuncionarios?: string | null
  vagasFuncionarios?: number | null
  nomeEmpresaFuncionarios?: string | null
  // So vem no detalhe do evento e na resposta do card de funcionarios
  resumoFuncionarios?: { naLista: number; inscritos: number; percentualTravado: boolean }
  _count?: { cupons: number }
  cupons?: {
    id: string
    codigo: string
    percentualDesconto: string
    quantidadeMaxima: number | null
    ativo: boolean
    // Inscricoes pagas com o cupom
    _count: { inscricoes: number }
  }[]
  createdAt: string
  organizador: {
    id: string
    cliente: {
      usuario: { email: string }
      pf: { nomeCompleto: string } | null
      pj: { razaoSocial: string } | null
    }
  }
  modalidades: { id: string; nome: string; distanciaKm: string | null }[]
}

export function useAdminEventos() {
  const eventos = useState<EventoAdmin[]>('admin_eventos', () => [])
  const api = useApi()

  async function fetchLista(status?: string) {
    const res = await api<EventoAdmin[]>('/admin/eventos', {
      query: status ? { status } : undefined
    })
    eventos.value = res
    return res
  }

  async function buscar(id: string) {
    return api<EventoAdmin>(`/admin/eventos/${id}`)
  }

  async function aprovar(id: string) {
    return api<EventoAdmin>(`/admin/eventos/${id}/aprovar`, { method: 'POST' })
  }

  async function rejeitar(id: string, motivo?: string) {
    return api<EventoAdmin>(`/admin/eventos/${id}/rejeitar`, {
      method: 'POST',
      body: { motivo }
    })
  }

  async function suspender(id: string, motivo?: string) {
    return api<EventoAdmin>(`/admin/eventos/${id}/suspender`, {
      method: 'POST',
      body: { motivo }
    })
  }

  async function configurarServidorPublico(id: string, liberado: boolean, vagas?: number | null) {
    return api<EventoAdmin>(`/admin/eventos/${id}/servidor-publico`, {
      method: 'POST',
      body: { liberado, vagas }
    })
  }

  async function definirLimiteCupons(id: string, config: { limiteCupons: number; usosPorCupom: number }) {
    return api<EventoAdmin>(`/admin/eventos/${id}/limite-cupons`, {
      method: 'POST',
      body: config
    })
  }

  async function configurarFuncionarios(
    id: string,
    config: { liberado: boolean; percentual?: number; vagas: number | null; nomeEmpresa: string | null }
  ) {
    return api<EventoAdmin>(`/admin/eventos/${id}/funcionarios`, {
      method: 'POST',
      body: config
    })
  }

  return { eventos, fetchLista, buscar, aprovar, rejeitar, suspender, configurarServidorPublico, definirLimiteCupons, configurarFuncionarios }
}
