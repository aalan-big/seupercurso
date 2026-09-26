// Lista de funcionarios do desconto da empresa organizadora. Recurso separado
// do servidor publico; so aparece quando o admin libera o evento.
export interface FuncionarioLista {
  id: string
  cpf: string
  matricula: string
  nome: string | null
  utilizadoEm: string | null
  createdAt: string
  emUso: boolean
}

export interface ResumoFuncionarios {
  permiteFuncionarios: boolean
  percentualFuncionarios: number | null
  vagasFuncionarios: number | null
  nomeEmpresaFuncionarios: string | null
  totalCadastrados: number
  totalUtilizados: number
  vagasRestantes: number | null
  funcionarios: FuncionarioLista[]
}

export function useFuncionariosOrganizador() {
  const api = useApi()

  async function obterFuncionarios(eventoId: string) {
    return api<ResumoFuncionarios>(`/organizadores/me/eventos/${eventoId}/funcionarios`)
  }

  async function uploadListaFuncionarios(eventoId: string, arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    return api<{
      sucesso: boolean
      totalLidos: number
      novosInseridos: number
      atualizados: number
      ignoradosEmUso: number
      amostra: { cpf: string; matricula: string; nome?: string }[]
      mensagem: string
    }>(`/organizadores/me/eventos/${eventoId}/funcionarios/upload`, {
      method: 'POST',
      body: formData
    })
  }

  async function limparFuncionariosNaoUtilizados(eventoId: string) {
    return api<{ sucesso: boolean; removidos: number; mensagem: string }>(
      `/organizadores/me/eventos/${eventoId}/funcionarios`,
      { method: 'DELETE' }
    )
  }

  return { obterFuncionarios, uploadListaFuncionarios, limparFuncionariosNaoUtilizados }
}
