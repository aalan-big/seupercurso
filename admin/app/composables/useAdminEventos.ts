export interface EventoAdmin {
  id: string
  nome: string
  descricao: string | null
  regulamentoUrl: string | null
  bannerUrl: string | null
  mapaPercursoUrl: string | null
  termoResponsabilidade: string | null
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  capacidade: number | null
  status: 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'PUBLICADO' | 'INSCRICOES_ENCERRADAS' | 'CANCELADO' | 'FINALIZADO' | 'SUSPENSO'
  motivoRejeicao: string | null
  createdAt: string
  organizador: {
    id: string
    cliente: {
      usuario: { email: string }
      pf: { nomeCompleto: string } | null
      pj: { razaoSocial: string } | null
    }
  }
  modalidades: { id: string; nome: string; distanciaKm: string }[]
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

  return { eventos, fetchLista, buscar, aprovar, rejeitar, suspender }
}
