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

export interface InscricaoComEvento {
  id: string
  numeroPeito: string | null
  tamanhoCamisa: string | null
  dataInscricao: string
  status: string
  categoria: {
    id: string
    nome: string
    genero: string
    modalidade: {
      id: string
      nome: string
      evento: { id: string; nome: string }
    }
  }
  lote: { id: string; nome: string }
  pagamentos: PagamentoDaInscricao[]
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

  return { minhasInscricoes, criar, fetchMinhas, cancelar }
}
