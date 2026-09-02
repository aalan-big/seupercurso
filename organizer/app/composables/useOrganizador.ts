export interface Organizador {
  id: string
  clienteId: string
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'
  plano: string | null
  comissaoPercentual: string
  tipoPessoa?: 'PF' | 'PJ'
  emailLogin?: string | null
  /** Conexao com o Mercado Pago; null enquanto o organizador nao autorizar. */
  mpUserId: string | null
  mpConectadoEm: string | null
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


  return {
    organizador,
    solicitarCadastro,
    fetchMe,
    uploadFotoRosto,
    uploadDocumentoIdentidade,
  }
}
