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
  status: string
  regulamentoUrl: string | null
  valorApartirDe: number | null
}

export interface CategoriaEvento {
  id: string
  nome: string
  idadeMinima: number | null
  idadeMaxima: number | null
  genero: 'MASCULINO' | 'FEMININO' | 'LIVRE'
  pcd: boolean
}

export interface ModalidadeEvento {
  id: string
  nome: string
  distanciaKm: string
  descricao: string | null
  idadeMinima: number | null
  idadeMaxima: number | null
  ativo: boolean
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
  modalidades: ModalidadeEvento[]
  lotes: LoteEvento[]
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
