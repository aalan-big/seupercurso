export interface CategoriaOrganizador {
  id: string
  modalidadeId: string
  nome: string
  idadeMinima: number | null
  idadeMaxima: number | null
  genero: 'MASCULINO' | 'FEMININO' | 'LIVRE'
  pcd: boolean
  servidorPublico?: boolean
  capacidade: number | null
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
  distanciaKm: string | null
  descricao: string | null
  idadeMinima: number | null
  idadeMaxima: number | null
  ativo: boolean
  capacidade: number | null
  mapaPercursoUrl: string | null
  mapaEmbedUrl: string | null
  gpxUrl: string | null
  rotaGeoJson: string | null
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

export interface ModeloCamisa {
  id: string
  eventoId: string
  nome: string
  descricao: string | null
  fotoFrenteUrl: string | null
  fotoVersoUrl: string | null
  ordem: number
  ativo: boolean
  createdAt?: string
  updatedAt?: string
}

export interface EventoOrganizador {
  id: string
  organizadorId: string
  nome: string
  descricao: string | null
  regulamentoUrl: string | null
  bannerUrl: string | null
  termoResponsabilidade: string | null
  retiradaKitLocal: string | null
  retiradaKitInicio: string | null
  retiradaKitFim: string | null
  possuiCamisa: boolean
  camisaOpcional?: boolean
  valorCamisaOpcional?: string | number | null
  limiteTrocaCamisaAté: string | null
  camisasBloqueadas: boolean
  permiteTransferencia: boolean
  aplicaDescontoIdoso: boolean
  percentualDescontoIdoso: string | null
  aceitaPix: boolean
  aceitaCartao: boolean
  comissaoPagaPeloAtleta: boolean
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  capacidade: number | null
  status: 'RASCUNHO' | 'AGUARDANDO_APROVACAO' | 'PUBLICADO' | 'INSCRICOES_ENCERRADAS' | 'CANCELADO' | 'FINALIZADO'
  motivoRejeicao: string | null
  permiteServidorPublico?: boolean
  vagasServidorPublico?: number | null
  // Quantos cupons o evento aceita; so o admin do Seu Percurso muda.
  limiteCupons?: number
  createdAt: string
  updatedAt: string
  modalidades?: ModalidadeOrganizador[]
  lotes?: LoteOrganizador[]
  modelosCamisa?: ModeloCamisa[]
}

export interface EventoOrganizadorInput {
  nome: string
  descricao?: string
  aceitaPix?: boolean
  aceitaCartao?: boolean
  comissaoPagaPeloAtleta?: boolean
  regulamentoUrl?: string
  termoResponsabilidade?: string
  retiradaKitLocal?: string
  retiradaKitInicio?: string
  retiradaKitFim?: string
  possuiCamisa?: boolean
  camisaOpcional?: boolean
  valorCamisaOpcional?: number
  limiteTrocaCamisaAté?: string
  camisasBloqueadas?: boolean
  permiteTransferencia?: boolean
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  capacidade?: number
  aplicaDescontoIdoso?: boolean
  percentualDescontoIdoso?: number
}

export interface EventoOrganizadorUpdateInput extends Partial<EventoOrganizadorInput> {
  status?: EventoOrganizador['status']
}

export interface ModalidadeInput {
  nome: string
  distanciaKm?: number | null
  descricao?: string
  idadeMinima?: number
  idadeMaxima?: number
  capacidade?: number
}

export interface ModalidadeUpdateInput extends Partial<Omit<ModalidadeInput, 'capacidade'>> {
  ativo?: boolean
  mapaEmbedUrl?: string
  rotaGeoJson?: string
  capacidade?: number | null
}

export interface CategoriaInput {
  nome: string
  idadeMinima?: number
  idadeMaxima?: number
  genero?: CategoriaOrganizador['genero']
  pcd?: boolean
  servidorPublico?: boolean
  capacidade?: number
}

export type CategoriaUpdateInput = Partial<Omit<CategoriaInput, 'capacidade'>> & {
  capacidade?: number | null
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

  async function uploadMidia(id: string, campo: 'banner' | 'regulamento', arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    const res = await api<EventoOrganizador>(`/organizadores/me/eventos/${id}/${campo}`, {
      method: 'PATCH',
      body: formData
    })
    eventoSelecionado.value = res
    return res
  }

  async function uploadMapaPercursoModalidade(eventoId: string, modalidadeId: string, arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    await api(`/organizadores/me/eventos/${eventoId}/modalidades/${modalidadeId}/mapa-percurso`, {
      method: 'PATCH',
      body: formData
    })
    await fetchEvento(eventoId)
  }

  async function uploadGpxModalidade(eventoId: string, modalidadeId: string, arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    await api(`/organizadores/me/eventos/${eventoId}/modalidades/${modalidadeId}/gpx`, {
      method: 'PATCH',
      body: formData
    })
    await fetchEvento(eventoId)
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

  async function atualizarCategoria(
    eventoId: string,
    modalidadeId: string,
    categoriaId: string,
    input: CategoriaUpdateInput
  ) {
    await api(`/organizadores/me/eventos/${eventoId}/modalidades/${modalidadeId}/categorias/${categoriaId}`, {
      method: 'PATCH',
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

  async function migrarInscricoesCategoria(eventoId: string, origemCategoriaId: string, destinoCategoriaId: string) {
    const res = await api<{ migrados: number; mensagem: string }>(`/organizadores/me/eventos/${eventoId}/categorias/migrar`, {
      method: 'POST',
      body: { origemCategoriaId, destinoCategoriaId }
    })
    await fetchEvento(eventoId)
    return res
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

  async function uploadListaServidores(eventoId: string, arquivo: File, categoriaId?: string) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    const query = categoriaId ? `?categoriaId=${categoriaId}` : ''
    return await api<{
      sucesso: boolean
      totalLidos: number
      novosInseridos: number
      mensagem: string
      amostra: any[]
    }>(`/organizadores/me/eventos/${eventoId}/servidores-publicos/upload${query}`, {
      method: 'POST',
      body: formData
    })
  }

  async function obterServidoresPublicos(eventoId: string) {
    return await api<{
      permiteServidorPublico: boolean
      vagasServidorPublico: number | null
      totalCadastrados: number
      totalUtilizados: number
      vagasRestantesVagasEvento: number | null
      servidores: Array<{
        id: string
        cpf: string
        matricula: string
        nome?: string
        orgao?: string
        utilizadoEm?: string | null
        inscricaoId?: string | null
        createdAt: string
        categoria?: { id: string; nome: string } | null
      }>
    }>(`/organizadores/me/eventos/${eventoId}/servidores-publicos`)
  }

  async function limparServidoresPublicos(eventoId: string) {
    return await api<{ sucesso: boolean; removidos: number; mensagem: string }>(
      `/organizadores/me/eventos/${eventoId}/servidores-publicos`,
      { method: 'DELETE' }
    )
  }

  async function listarModelosCamisa(eventoId: string) {
    return await api<ModeloCamisa[]>(`/organizadores/me/eventos/${eventoId}/modelos-camisa`)
  }

  async function criarModeloCamisa(
    eventoId: string,
    input: { nome: string; descricao?: string; ordem?: number; ativo?: boolean }
  ) {
    const res = await api<ModeloCamisa>(`/organizadores/me/eventos/${eventoId}/modelos-camisa`, {
      method: 'POST',
      body: input
    })
    await fetchEvento(eventoId)
    return res
  }

  async function atualizarModeloCamisa(
    eventoId: string,
    modeloId: string,
    input: Partial<{ nome: string; descricao?: string; ordem?: number; ativo?: boolean }>
  ) {
    const res = await api<ModeloCamisa>(`/organizadores/me/eventos/${eventoId}/modelos-camisa/${modeloId}`, {
      method: 'PATCH',
      body: input
    })
    await fetchEvento(eventoId)
    return res
  }

  async function removerModeloCamisa(eventoId: string, modeloId: string) {
    await api(`/organizadores/me/eventos/${eventoId}/modelos-camisa/${modeloId}`, { method: 'DELETE' })
    await fetchEvento(eventoId)
  }

  async function uploadFotoModeloCamisa(
    eventoId: string,
    modeloId: string,
    tipo: 'frente' | 'verso',
    arquivo: File
  ) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    const endpoint = tipo === 'frente' ? 'foto-frente' : 'foto-verso'
    const res = await api<ModeloCamisa>(
      `/organizadores/me/eventos/${eventoId}/modelos-camisa/${modeloId}/${endpoint}`,
      {
        method: 'PATCH',
        body: formData
      }
    )
    await fetchEvento(eventoId)
    return res
  }

  return {
    eventos,
    eventoSelecionado,
    fetchMeusEventos,
    fetchEventos: fetchMeusEventos,
    fetchEvento,
    criarEvento,
    atualizarEvento,
    uploadMidia,
    uploadMapaPercursoModalidade,
    uploadGpxModalidade,
    criarModalidade,
    atualizarModalidade,
    removerModalidade,
    criarCategoria,
    atualizarCategoria,
    removerCategoria,
    migrarInscricoesCategoria,
    criarLote,
    atualizarLote,
    removerLote,
    definirPreco,
    uploadListaServidores,
    obterServidoresPublicos,
    limparServidoresPublicos,
    listarModelosCamisa,
    criarModeloCamisa,
    atualizarModeloCamisa,
    removerModeloCamisa,
    uploadFotoModeloCamisa
  }
}
