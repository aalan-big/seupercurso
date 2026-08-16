export interface CategoriaOrganizador {
  id: string
  modalidadeId: string
  nome: string
  idadeMinima: number | null
  idadeMaxima: number | null
  genero: 'MASCULINO' | 'FEMININO' | 'LIVRE'
  pcd: boolean
}

export interface PrecoLoteOrganizador {
  id: string
  loteId: string
  modalidadeId: string
  valor: string
}

export interface ModalidadeOrganizador {
  id: string
  eventoId: string
  nome: string
  distanciaKm: string
  descricao: string | null
  idadeMinima: number | null
  idadeMaxima: number | null
  ativo: boolean
  categorias: CategoriaOrganizador[]
}

export interface LoteOrganizador {
  id: string
  eventoId: string
  nome: string
  quantidade: number | null
  inicioVenda: string
  fimVenda: string
  precos: PrecoLoteOrganizador[]
}

export interface EventoOrganizador {
  id: string
  organizadorId: string
  nome: string
  descricao: string | null
  regulamentoUrl: string | null
  bannerUrl: string | null
  mapaPercursoUrl: string | null
  termoResponsabilidade: string | null
  retiradaKitLocal: string | null
  retiradaKitInicio: string | null
  retiradaKitFim: string | null
  aplicaDescontoIdoso: boolean
  percentualDescontoIdoso: string | null
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  capacidade: number | null
  status: 'RASCUNHO' | 'PUBLICADO' | 'INSCRICOES_ENCERRADAS' | 'CANCELADO' | 'FINALIZADO'
  createdAt: string
  updatedAt: string
  modalidades?: ModalidadeOrganizador[]
  lotes?: LoteOrganizador[]
}

export interface EventoOrganizadorInput {
  nome: string
  descricao?: string
  regulamentoUrl?: string
  termoResponsabilidade?: string
  retiradaKitLocal?: string
  retiradaKitInicio?: string
  retiradaKitFim?: string
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  capacidade?: number
}

export interface EventoOrganizadorUpdateInput extends Partial<EventoOrganizadorInput> {
  status?: EventoOrganizador['status']
  aplicaDescontoIdoso?: boolean
  percentualDescontoIdoso?: number
}

export interface ModalidadeInput {
  nome: string
  distanciaKm: number
  descricao?: string
  idadeMinima?: number
  idadeMaxima?: number
}

export interface ModalidadeUpdateInput extends Partial<ModalidadeInput> {
  ativo?: boolean
}

export interface CategoriaInput {
  nome: string
  idadeMinima?: number
  idadeMaxima?: number
  genero?: CategoriaOrganizador['genero']
  pcd?: boolean
}

export interface LoteInput {
  nome: string
  quantidade?: number
  inicioVenda: string
  fimVenda: string
}

export type LoteUpdateInput = Partial<LoteInput>

export function useEventoOrganizador() {
  const eventos = useState<EventoOrganizador[]>('organizador_eventos', () => [])
  const eventoSelecionado = useState<EventoOrganizador | null>('organizador_evento_selecionado', () => null)
  const api = useApi()

  async function fetchMeusEventos() {
    const res = await api<EventoOrganizador[]>('/organizadores/me/eventos')
    eventos.value = res
    return res
  }

  async function fetchEvento(id: string) {
    const res = await api<EventoOrganizador>(`/organizadores/me/eventos/${id}`)
    eventoSelecionado.value = res
    return res
  }

  async function criarEvento(input: EventoOrganizadorInput) {
    return await api<EventoOrganizador>('/organizadores/me/eventos', {
      method: 'POST',
      body: input
    })
  }

  async function atualizarEvento(id: string, input: EventoOrganizadorUpdateInput) {
    const res = await api<EventoOrganizador>(`/organizadores/me/eventos/${id}`, {
      method: 'PATCH',
      body: input
    })
    eventoSelecionado.value = res
    return res
  }

  async function uploadMidia(id: string, campo: 'banner' | 'mapa-percurso' | 'regulamento', arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    const res = await api<EventoOrganizador>(`/organizadores/me/eventos/${id}/${campo}`, {
      method: 'PATCH',
      body: formData
    })
    eventoSelecionado.value = res
    return res
  }

  async function criarModalidade(eventoId: string, input: ModalidadeInput) {
    await api(`/organizadores/me/eventos/${eventoId}/modalidades`, { method: 'POST', body: input })
    await fetchEvento(eventoId)
  }

  async function atualizarModalidade(eventoId: string, modalidadeId: string, input: ModalidadeUpdateInput) {
    await api(`/organizadores/me/eventos/${eventoId}/modalidades/${modalidadeId}`, {
      method: 'PATCH',
      body: input
    })
    await fetchEvento(eventoId)
  }

  async function removerModalidade(eventoId: string, modalidadeId: string) {
    await api(`/organizadores/me/eventos/${eventoId}/modalidades/${modalidadeId}`, { method: 'DELETE' })
    await fetchEvento(eventoId)
  }

  async function criarCategoria(eventoId: string, modalidadeId: string, input: CategoriaInput) {
    await api(`/organizadores/me/eventos/${eventoId}/modalidades/${modalidadeId}/categorias`, {
      method: 'POST',
      body: input
    })
    await fetchEvento(eventoId)
  }

  async function removerCategoria(eventoId: string, modalidadeId: string, categoriaId: string) {
    await api(`/organizadores/me/eventos/${eventoId}/modalidades/${modalidadeId}/categorias/${categoriaId}`, {
      method: 'DELETE'
    })
    await fetchEvento(eventoId)
  }

  async function criarLote(eventoId: string, input: LoteInput) {
    await api(`/organizadores/me/eventos/${eventoId}/lotes`, { method: 'POST', body: input })
    await fetchEvento(eventoId)
  }

  async function atualizarLote(eventoId: string, loteId: string, input: LoteUpdateInput) {
    await api(`/organizadores/me/eventos/${eventoId}/lotes/${loteId}`, {
      method: 'PATCH',
      body: input
    })
    await fetchEvento(eventoId)
  }

  async function removerLote(eventoId: string, loteId: string) {
    await api(`/organizadores/me/eventos/${eventoId}/lotes/${loteId}`, { method: 'DELETE' })
    await fetchEvento(eventoId)
  }

  async function definirPreco(eventoId: string, loteId: string, modalidadeId: string, valor: number) {
    await api(`/organizadores/me/eventos/${eventoId}/lotes/${loteId}/precos/${modalidadeId}`, {
      method: 'PUT',
      body: { valor }
    })
    await fetchEvento(eventoId)
  }

  return {
    eventos,
    eventoSelecionado,
    fetchMeusEventos,
    fetchEvento,
    criarEvento,
    atualizarEvento,
    uploadMidia,
    criarModalidade,
    atualizarModalidade,
    removerModalidade,
    criarCategoria,
    removerCategoria,
    criarLote,
    atualizarLote,
    removerLote,
    definirPreco
  }
}
