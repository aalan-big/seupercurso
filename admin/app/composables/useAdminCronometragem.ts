export interface UsuarioCronometradora {
  usuarioId: string
  cronometradoraId: string
  papel: 'ADMIN' | 'OPERADOR'
  ativo: boolean
  createdAt: string
  usuario: {
    id: string
    email: string
    cliente?: {
      pf?: { nomeCompleto: string } | null
      pj?: { razaoSocial: string; nomeFantasia?: string | null } | null
    } | null
  }
}

/** Computador que usa o SeuPercurso Mark (conta no limite do plano). */
export interface NotebookCronometragem {
  id: string
  maquinaId: string
  ativo: boolean
  ultimoEmail: string | null
  primeiroUsoEm: string
  ultimoUsoEm: string
}

export interface CronometradoraAdmin {
  id: string
  nome: string
  documento: string | null
  plano: string
  assinaturaValidaAte: string
  status: 'ATIVA' | 'BLOQUEADA' | 'CANCELADA'
  limiteNotebooks: number
  notebooks: NotebookCronometragem[]
  createdAt: string
  updatedAt: string
  _count: {
    usuarios: number
    solicitacoes: number
    passagens: number
  }
  usuarios: UsuarioCronometradora[]
}

export interface SolicitacaoAdminItem {
  id: string
  cronometradoraId: string
  eventoId: string
  status: string
  mensagem: string
  resposta: string | null
  validaAte: string | null
  createdAt: string
  cronometradora: {
    id: string
    nome: string
    documento: string | null
  }
  evento: {
    id: string
    nome: string
    cidade: string
    estado: string
    dataInicio: string
    organizador?: {
      cliente?: {
        pf?: { nomeCompleto: string } | null
        pj?: { razaoSocial: string; nomeFantasia?: string | null } | null
      } | null
    } | null
  }
}

export interface AuditoriaCronometragemItem {
  id: string
  usuarioId: string
  cronometradoraId: string
  eventoId: string | null
  acao: string
  detalhe: string | null
  createdAt: string
  cronometradora: {
    id: string
    nome: string
  }
}

export function useAdminCronometragem() {
  const empresas = useState<CronometradoraAdmin[]>('admin_cronometradoras', () => [])
  const solicitacoes = useState<SolicitacaoAdminItem[]>('admin_cronometragem_solicitacoes', () => [])
  const auditorias = useState<AuditoriaCronometragemItem[]>('admin_cronometragem_auditorias', () => [])
  const api = useApi()

  async function fetchEmpresas() {
    const res = await api<CronometradoraAdmin[]>('/admin/cronometragem/empresas')
    empresas.value = res
    return res
  }

  async function criarEmpresa(dto: {
    nome: string
    documento?: string
    plano?: string
    assinaturaValidaAte?: string
    limiteNotebooks?: number
  }) {
    const res = await api<CronometradoraAdmin>('/admin/cronometragem/empresas', {
      method: 'POST',
      body: dto,
    })
    await fetchEmpresas()
    return res
  }

  async function renovarAssinatura(id: string, dto: { dias?: number; meses?: number; novaData?: string }) {
    const res = await api<CronometradoraAdmin>(`/admin/cronometragem/empresas/${id}/assinatura`, {
      method: 'PATCH',
      body: dto,
    })
    await fetchEmpresas()
    return res
  }

  async function alterarStatus(id: string, status: 'ATIVA' | 'BLOQUEADA' | 'CANCELADA') {
    const res = await api<CronometradoraAdmin>(`/admin/cronometragem/empresas/${id}/status`, {
      method: 'PATCH',
      body: { status },
    })
    await fetchEmpresas()
    return res
  }

  async function vincularUsuario(id: string, dto: { email: string; papel?: 'ADMIN' | 'OPERADOR' }) {
    const res = await api<UsuarioCronometradora>(`/admin/cronometragem/empresas/${id}/usuarios`, {
      method: 'POST',
      body: dto,
    })
    await fetchEmpresas()
    return res
  }

  async function atualizarUsuario(
    usuarioId: string,
    dto: { ativo?: boolean; desvincular?: boolean; papel?: 'ADMIN' | 'OPERADOR' }
  ) {
    const res = await api<any>(`/admin/cronometragem/usuarios/${usuarioId}`, {
      method: 'PATCH',
      body: dto,
    })
    await fetchEmpresas()
    return res
  }

  async function alterarLimiteNotebooks(id: string, limite: number) {
    const res = await api<CronometradoraAdmin>(`/admin/cronometragem/empresas/${id}/limite-notebooks`, {
      method: 'PATCH',
      body: { limite },
    })
    await fetchEmpresas()
    return res
  }

  async function liberarNotebook(notebookId: string) {
    const res = await api<NotebookCronometragem>(`/admin/cronometragem/notebooks/${notebookId}/liberar`, {
      method: 'PATCH',
    })
    await fetchEmpresas()
    return res
  }

  async function fetchSolicitacoes() {
    const res = await api<SolicitacaoAdminItem[]>('/admin/cronometragem/solicitacoes')
    solicitacoes.value = res
    return res
  }

  async function fetchAuditoria() {
    const res = await api<AuditoriaCronometragemItem[]>('/admin/cronometragem/auditoria')
    auditorias.value = res
    return res
  }

  return {
    empresas,
    solicitacoes,
    auditorias,
    fetchEmpresas,
    criarEmpresa,
    renovarAssinatura,
    alterarStatus,
    vincularUsuario,
    atualizarUsuario,
    alterarLimiteNotebooks,
    liberarNotebook,
    fetchSolicitacoes,
    fetchAuditoria,
  }
}
