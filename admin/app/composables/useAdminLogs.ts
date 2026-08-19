export interface AuditLogItem {
  id: string
  categoria: 'FINANCEIRO' | 'SEGURANCA' | 'OPERACIONAL' | 'ASAAS_WEBHOOK'
  nivel: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'
  mensagem: string
  detalhes: any
  usuarioId: string | null
  ip: string | null
  createdAt: string
}

export interface AuditLogResponse {
  itens: AuditLogItem[]
  total: number
  pagina: number
  totalPaginas: number
}

export function useAdminLogs() {
  const logs = useState<AuditLogItem[]>('admin_audit_logs', () => [])
  const totalLogs = useState<number>('admin_total_logs', () => 0)
  const totalPaginas = useState<number>('admin_total_paginas_logs', () => 1)
  const api = useApi()

  async function fetchLogs(query?: {
    categoria?: string
    nivel?: string
    busca?: string
    pagina?: number
  }) {
    const res = await api<AuditLogResponse>('/admin/logs', { query })
    logs.value = res.itens
    totalLogs.value = res.total
    totalPaginas.value = res.totalPaginas
    return res
  }

  return {
    logs,
    totalLogs,
    totalPaginas,
    fetchLogs
  }
}
