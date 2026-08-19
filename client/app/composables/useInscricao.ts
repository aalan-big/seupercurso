export interface InscricaoCriada {
  id: string
  clienteId: string
  categoriaId: string
  loteId: string
  numeroPeito: string | null
  tamanhoCamisa: string | null
  dataInscricao: string
  status: string
  valor: string
}

export interface PagamentoDaInscricao {
  id: string
  inscricaoId: string
  valor: string
  metodo: string
  status: string
  codigoTransacao: string | null
  dataPagamento: string | null
  createdAt: string
}

export interface CategoriaInfo {
  id: string
  nome: string
  idadeMinima?: number | null
  idadeMaxima?: number | null
  genero: string
  pcd: boolean
}

export interface ModalidadeInfo {
  id: string
  nome: string
  distanciaKm: number | string
  descricao?: string | null
  categorias?: CategoriaInfo[]
}

export interface EventoInfo {
  id: string
  nome: string
  descricao?: string | null
  bannerUrl?: string | null
  mapaPercursoUrl?: string | null
  mapaEmbedUrl?: string | null
  rotaGeoJson?: string | null
  regulamentoUrl?: string | null
  retiradaKitLocal?: string | null
  retiradaKitInicio?: string | null
  retiradaKitFim?: string | null
  limiteTrocaCamisaAté?: string | null
  camisasBloqueadas?: boolean
  permiteTransferencia?: boolean
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  status: string
  modalidades?: ModalidadeInfo[]
}

export interface ResultadoInfo {
  id: string
  tempoBrutoSegundos?: number | null
  tempoLiquidoSegundos?: number | null
  colocacaoGeral?: number | null
  colocacaoCategoria?: number | null
  colocacaoGenero?: number | null
  status: string
}

export interface CertificadoInfo {
  id: string
  urlPdf: string
  dataEmissao: string
}

export interface InscricaoComEvento {
  id: string
  numeroPeito: string | null
  tamanhoCamisa: string | null
  kitEntregueEm: string | null
  dataInscricao: string
  status: string
  categoria: {
    id: string
    nome: string
    genero: string
    modalidade: {
      id: string
      nome: string
      distanciaKm: number | string
      evento: EventoInfo
    }
  }
  lote: { id: string; nome: string }
  pagamentos: PagamentoDaInscricao[]
  resultado?: ResultadoInfo | null
  certificado?: CertificadoInfo | null
}

export interface CreateInscricaoInput {
  categoriaId: string
  loteId: string
  tamanhoCamisa?: string
  cupomCodigo?: string
}

export function useInscricao() {
  const minhasInscricoes = useState<InscricaoComEvento[]>('inscricoes_minhas', () => [])
  const api = useApi()

  async function criar(input: CreateInscricaoInput) {
    const res = await api<InscricaoCriada>('/inscricoes', { method: 'POST', body: input })
    await fetchMinhas()
    return res
  }

  async function fetchMinhas() {
    const res = await api<InscricaoComEvento[]>('/inscricoes/me')
    minhasInscricoes.value = res
    return res
  }

  async function cancelar(id: string) {
    await api(`/inscricoes/${id}/cancelar`, { method: 'PATCH' })
    await fetchMinhas()
  }

  async function atualizarTamanhoCamisa(id: string, tamanhoCamisa: string) {
    await api(`/inscricoes/${id}/tamanho-camisa`, { method: 'PATCH', body: { tamanhoCamisa } })
    await fetchMinhas()
  }

  async function trocarCategoria(id: string, novaCategoriaId: string) {
    await api(`/inscricoes/${id}/trocar-categoria`, { method: 'PATCH', body: { novaCategoriaId } })
    await fetchMinhas()
  }

  async function transferirInscricao(id: string, emailDestino: string) {
    await api(`/inscricoes/${id}/transferir`, { method: 'POST', body: { emailDestino } })
    await fetchMinhas()
  }

  async function pagarInscricao(inscricaoId: string, metodo: 'PIX' | 'CREDITO' = 'PIX') {
    const res = await api<{ id: string; status: string; pixCopiaECola?: string; pixQrCodeUrl?: string }>('/pagamentos', {
      method: 'POST',
      body: { inscricaoId, metodo }
    })
    await fetchMinhas()
    return res
  }

  return {
    minhasInscricoes,
    criar,
    fetchMinhas,
    cancelar,
    atualizarTamanhoCamisa,
    trocarCategoria,
    transferirInscricao,
    pagarInscricao
  }
}
