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
  asaasPaymentId?: string | null
  pixCopiaECola?: string | null
  pixQrCodeUrl?: string | null
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
  mapaPercursoUrl?: string | null
  mapaEmbedUrl?: string | null
  gpxUrl?: string | null
  rotaGeoJson?: string | null
  categorias?: CategoriaInfo[]
}

export interface EventoInfo {
  id: string
  nome: string
  descricao?: string | null
  bannerUrl?: string | null
  regulamentoUrl?: string | null
  retiradaKitLocal?: string | null
  retiradaKitInicio?: string | null
  retiradaKitFim?: string | null
  limiteTrocaCamisaAté?: string | null
  camisasBloqueadas?: boolean
  permiteTransferencia?: boolean
  aceitaPix?: boolean
  aceitaCartao?: boolean
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
  atletaNome?: string | null
  atletaCpf?: string | null
  dependente?: {
    id: string
    nomeCompleto: string
    cpf: string
  } | null
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
      mapaPercursoUrl?: string | null
      mapaEmbedUrl?: string | null
      gpxUrl?: string | null
      rotaGeoJson?: string | null
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

export interface InscricaoItemInput {
  categoriaId: string
  loteId: string
  tamanhoCamisa?: string
  cupomCodigo?: string
  dependenteId?: string
  atleta?: {
    nomeCompleto: string
    cpf: string
    dataNascimento: string
    genero: 'MASCULINO' | 'FEMININO' | 'OUTRO'
    pcd?: boolean
  }
}

export interface InscricaoBatchCriada {
  pedidoId: string
  valorTotal: number
  inscricoes: InscricaoCriada[]
}

export function useInscricao() {
  const minhasInscricoes = useState<InscricaoComEvento[]>('inscricoes_minhas', () => [])
  const api = useApi()

  async function criar(input: CreateInscricaoInput) {
    const res = await api<InscricaoCriada>('/inscricoes', { method: 'POST', body: input })
    await fetchMinhas()
    return res
  }

  async function criarBatch(items: InscricaoItemInput[]) {
    const res = await api<InscricaoBatchCriada>('/inscricoes/batch', { method: 'POST', body: { items } })
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

  async function pagarInscricao(
    inscricaoId?: string,
    metodo: 'PIX' | 'CARTAO_CREDITO' | 'CREDITO' = 'PIX',
    cartaoDados?: {
      holderName?: string
      numero?: string
      mesValidade?: string
      anoValidade?: string
      ccv?: string
      parcelas?: number
      cpfTitular?: string
      cep?: string
      numeroResidencia?: string
    },
    pedidoId?: string
  ) {
    const metodoMapeado = metodo === 'CREDITO' ? 'CARTAO_CREDITO' : metodo
    const res = await api<{ id: string; status: string; valor?: string; pixCopiaECola?: string; pixQrCodeUrl?: string }>('/pagamentos', {
      method: 'POST',
      body: {
        ...(inscricaoId ? { inscricaoId } : {}),
        ...(pedidoId ? { pedidoId } : {}),
        metodo: metodoMapeado,
        ...(cartaoDados
          ? {
              cartaoHolderName: cartaoDados.holderName,
              cartaoNumero: cartaoDados.numero,
              cartaoMesValidade: cartaoDados.mesValidade,
              cartaoAnoValidade: cartaoDados.anoValidade,
              cartaoCcv: cartaoDados.ccv,
              parcelas: cartaoDados.parcelas,
              // Sem CPF do titular e endereço o antifraude do Asaas recusa a cobrança.
              cpfTitular: cartaoDados.cpfTitular,
              cep: cartaoDados.cep,
              numeroResidencia: cartaoDados.numeroResidencia
            }
          : {})
      }
    })
    await fetchMinhas()
    return res
  }

  return {
    minhasInscricoes,
    criar,
    criarBatch,
    fetchMinhas,
    cancelar,
    atualizarTamanhoCamisa,
    trocarCategoria,
    transferirInscricao,
    pagarInscricao
  }
}
