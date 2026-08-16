import type { OrganizadorAdmin } from './useAdminOrganizadores'
import type { EventoAdmin } from './useAdminEventos'

export interface DashboardAdmin {
  contadores: {
    organizadoresPendentes: number
    eventosAguardandoAprovacao: number
    organizadoresAprovados: number
    eventosPublicados: number
    inscricoesConfirmadas: number
  }
  organizadoresPorStatus: Record<string, number>
  eventosPorStatus: Record<string, number>
  inscricoesPorDia: { data: string; quantidade: number }[]
  organizadoresRecentes: OrganizadorAdmin[]
  eventosRecentes: EventoAdmin[]
}

export function useAdminDashboard() {
  const api = useApi()

  async function buscar() {
    return api<DashboardAdmin>('/admin/dashboard')
  }

  return { buscar }
}
