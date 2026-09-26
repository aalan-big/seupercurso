export interface EventoResumo {
  id: string
  nome: string
  descricao: string | null
  dataInicio: string
  dataFim: string
  local: string
  cidade: string
  estado: string
  capacidade: number | null
  vagasRestantes?: number | null
  status: string
  aceitaPix?: boolean
  aceitaCartao?: boolean
  bannerUrl?: string | null
  possuiCamisa?: boolean
  camisaOpcional?: boolean
  valorCamisaOpcional?: string | number | null
  aplicaDescontoIdoso?: boolean
  percentualDescontoIdoso?: string | number | null
  permiteServidorPublico?: boolean
  vagasServidorPublico?: number | null
  valorApartirDe: number | null
  // Pelas janelas dos lotes (servidor). null fora de evento publicado; na
  // duvida o servidor responde ABERTAS.
  situacaoVendas?: 'ABERTAS' | 'EM_BREVE' | 'ENCERRADAS' | null
  vendasAbremEm?: string | null
}

export interface ModeloCamisaEvento {
  id: string
  nome: string
  descricao?: string | null
  fotoFrenteUrl?: string | null
  fotoVersoUrl?: string | null
  ordem: number
}

export interface CategoriaEvento {
  id: string
  capacidade?: number | null
  vagasRestantes?: number | null
  nome: string
  idadeMinima: number | null
  idadeMaxima: number | null
  genero: 'MASCULINO' | 'FEMININO' | 'LIVRE'
  pcd: boolean
  servidorPublico?: boolean
}

export interface ModalidadeEvento {
  id: string
  nome: string
  distanciaKm: string | null
  descricao: string | null
  idadeMinima: number | null
  idadeMaxima: number | null
  ativo: boolean
  capacidade?: number | null
  vagasRestantes?: number | null
  mapaPercursoUrl: string | null
  mapaEmbedUrl: string | null
  gpxUrl: string | null
  rotaGeoJson: string | null
  categorias: CategoriaEvento[]
}

export interface PrecoLote {
  id: string
  modalidadeId: string
  valor: string
}

export interface LoteEvento {
  id: string
  nome: string
  quantidade: number | null
  inicioVenda: string
  fimVenda: string
  precos: PrecoLote[]
  vagasRestantes: number | null
}

export interface EventoDetalhe extends EventoResumo {
  // Hora do servidor quando respondeu, para a contagem regressiva
  agoraServidor?: string
  modalidades: ModalidadeEvento[]
  lotes: LoteEvento[]
  modelosCamisa?: ModeloCamisaEvento[]
}

export function useEvento() {
  const eventos = useState<EventoResumo[]>('eventos_lista', () => [])
  const eventoSelecionado = useState<EventoDetalhe | null>('evento_selecionado', () => null)
  const api = useApi()

  async function fetchEventos() {
    const res = await api<EventoResumo[]>('/eventos')
    eventos.value = res
    return res
  }

  async function fetchEvento(id: string) {
    const res = await api<EventoDetalhe>(`/eventos/${id}`)
    eventoSelecionado.value = res
    return res
  }

  return { eventos, eventoSelecionado, fetchEventos, fetchEvento }
}
