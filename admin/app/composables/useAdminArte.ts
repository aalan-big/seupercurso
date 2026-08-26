export interface SolicitacaoArteAdmin {
  id: string
  status: 'PENDENTE_PAGAMENTO' | 'PAGO' | 'EM_PRODUCAO' | 'ENTREGUE' | 'CANCELADO'
  valor: string
  observacoes: string | null
  arquivoEntregueUrl: string | null
  motivoCancelamento: string | null
  createdAt: string
  updatedAt: string
  evento: {
    id: string
    nome: string
    bannerUrl: string | null
  }
  organizador: {
    id: string
    cliente: {
      usuario: { email: string }
      pf: { nomeCompleto: string } | null
      pj: { razaoSocial: string } | null
    }
  }
}

export interface ConfiguracaoPlataforma {
  id: string
  precoArteEvento: string
  updatedAt: string
}

export function useAdminArte() {
  const solicitacoes = useState<SolicitacaoArteAdmin[]>('admin_arte_solicitacoes', () => [])
  const api = useApi()

  async function fetchLista(status?: string) {
    const res = await api<SolicitacaoArteAdmin[]>('/admin/solicitacoes-arte', {
      query: status ? { status } : undefined
    })
    solicitacoes.value = res
    return res
  }

  async function buscar(id: string) {
    return api<SolicitacaoArteAdmin>(`/admin/solicitacoes-arte/${id}`)
  }

  async function iniciarProducao(id: string) {
    return api<SolicitacaoArteAdmin>(`/admin/solicitacoes-arte/${id}/iniciar-producao`, { method: 'POST' })
  }

  async function cancelar(id: string, motivo?: string) {
    return api<SolicitacaoArteAdmin>(`/admin/solicitacoes-arte/${id}/cancelar`, {
      method: 'POST',
      body: { motivo }
    })
  }

  async function entregar(id: string, arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    return api<SolicitacaoArteAdmin>(`/admin/solicitacoes-arte/${id}/entregar`, {
      method: 'POST',
      body: formData
    })
  }

  async function obterPreco() {
    return api<ConfiguracaoPlataforma>('/admin/configuracoes/preco-arte')
  }

  async function atualizarPreco(valor: number) {
    return api<ConfiguracaoPlataforma>('/admin/configuracoes/preco-arte', {
      method: 'PUT',
      body: { valor }
    })
  }

  return { solicitacoes, fetchLista, buscar, iniciarProducao, cancelar, entregar, obterPreco, atualizarPreco }
}
