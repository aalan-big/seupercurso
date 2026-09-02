export interface AlteracaoDocumento {
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
}

/**
 * Troca de CPF/CNPJ do titular. O documento define para qual conta o saque cai,
 * entao a alteracao passa por analise com foto do documento e bloqueia saques
 * enquanto estiver pendente.
 */
export function useAlteracaoDocumento() {
  const api = useApi()

  async function listar() {
    return api<AlteracaoDocumento[]>('/clientes/me/alteracao-documento')
  }

  async function solicitar(documentoNovo: string, arquivo: File, motivo?: string) {
    const formData = new FormData()
    formData.append('documento', arquivo)
    formData.append('documentoNovo', documentoNovo)
    if (motivo) formData.append('motivo', motivo)

    return api<AlteracaoDocumento>('/clientes/me/alteracao-documento', {
      method: 'POST',
      body: formData
    })
  }

  return { listar, solicitar }
}
