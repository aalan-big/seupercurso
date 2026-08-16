export interface EventoProximo {
  id: string
  nome: string
  dataInicio: string
  cidade: string
  estado: string
}

export interface DashboardOrganizador {
  contadores: {
    totalEventos: number
    eventosPublicados: number
    eventosAguardandoAprovacao: number
    inscricoesConfirmadas: number
    kitsPendentes: number
  }
  eventosPorStatus: Record<string, number>
  inscricoesPorDia: { data: string; quantidade: number }[]
  proximosEventos: EventoProximo[]
}

export function useDashboardOrganizador() {
  const api = useApi()

  async function buscar() {
    return api<DashboardOrganizador>('/organizadores/me/dashboard')
  }

  return { buscar }
}
