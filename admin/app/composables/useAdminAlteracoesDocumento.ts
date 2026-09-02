export interface AlteracaoDocumentoAdmin {
  id: string
  tipo: 'CPF' | 'CNPJ'
  documentoAtual: string
  documentoNovo: string
  arquivoUrl: string
  motivo: string | null
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA'
  motivoRejeicao: string | null
  revisadoEm: string | null
  createdAt: string
  cliente: {
    usuario: { email: string }
    pf: { nomeCompleto: string; cpf: string } | null
    pj: { razaoSocial: string; cnpj: string } | null
    organizador: { id: string; status: string } | null
  }
}

export function useAdminAlteracoesDocumento() {
  const api = useApi()

  async function listar(status?: 'PENDENTE' | 'APROVADA' | 'REJEITADA') {
    return api<AlteracaoDocumentoAdmin[]>('/admin/alteracoes-documento', {
      query: status ? { status } : undefined
    })
  }

  async function aprovar(id: string) {
    return api<AlteracaoDocumentoAdmin>(`/admin/alteracoes-documento/${id}/aprovar`, {
      method: 'POST'
    })
  }

  async function rejeitar(id: string, motivo: string) {
    return api<AlteracaoDocumentoAdmin>(`/admin/alteracoes-documento/${id}/rejeitar`, {
      method: 'POST',
      body: { motivo }
    })
  }

  return { listar, aprovar, rejeitar }
}
