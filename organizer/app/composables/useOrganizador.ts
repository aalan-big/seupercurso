export interface Organizador {
  id: string
  clienteId: string
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'
  plano: string | null
  comissaoPercentual: string
  chavePix: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  tipoConta: string | null
  rendaFaturamentoMensal: string | null
  tipoEmpresa: 'MEI' | 'LIMITED' | 'INDIVIDUAL' | 'ASSOCIATION' | null
  emailRecebimento: string | null
  tipoPessoa?: 'PF' | 'PJ'
  /** E-mail de login, usado como padrao da conta de recebimento. */
  emailLogin?: string
  asaasWalletId: string | null
  fotoRostoUrl: string | null
  documentoIdentidadeUrl: string | null
  motivoRevisao: string | null
  createdAt: string
  updatedAt: string
}

export function useOrganizador() {
  const organizador = useState<Organizador | null>('organizador_perfil', () => null)
  const api = useApi()

  async function solicitarCadastro() {
    const res = await api<Organizador>('/organizadores/me', { method: 'POST' })
    organizador.value = res
    return res
  }

  async function fetchMe() {
    const res = await api<Organizador>('/organizadores/me')
    organizador.value = res
    return res
  }

  async function uploadFotoRosto(arquivo: File) {
    const formData = new FormData()
    formData.append('foto', arquivo)
    const res = await api<Organizador>('/organizadores/me/foto-rosto', {
      method: 'PATCH',
      body: formData
    })
    organizador.value = res
    return res
  }

  async function uploadDocumentoIdentidade(arquivo: File) {
    const formData = new FormData()
    formData.append('documento', arquivo)
    const res = await api<Organizador>('/organizadores/me/documento-identidade', {
      method: 'PATCH',
      body: formData
    })
    organizador.value = res
    return res
  }

  async function atualizarDadosBancarios(input: {
    chavePix?: string
    banco?: string
    agencia?: string
    conta?: string
    tipoConta?: string
    rendaFaturamentoMensal?: number
    tipoEmpresa?: string
    emailRecebimento?: string
  }) {
    const res = await api<Organizador>('/organizadores/me/dados-bancarios', {
      method: 'PATCH',
      body: input
    })
    organizador.value = res
    return res
  }

  return {
    organizador,
    solicitarCadastro,
    fetchMe,
    uploadFotoRosto,
    uploadDocumentoIdentidade,
    atualizarDadosBancarios
  }
}
