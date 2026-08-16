export interface EventoStaff {
  id: string
  nome: string
}

export interface InscricaoCheckin {
  id: string
  numeroPeito: string | null
  tamanhoCamisa: string | null
  status: 'PENDENTE_PAGAMENTO' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA'
  kitEntregueEm: string | null
  cliente: { pf: { nomeCompleto: string; cpf: string } | null }
  categoria: { nome: string; modalidade: { nome: string } }
}

export function useStaffCheckin() {
  const eventos = useState<EventoStaff[]>('staff_eventos', () => [])
  const resultados = useState<InscricaoCheckin[]>('staff_checkin_resultados', () => [])
  const api = useStaffApi()

  async function fetchEventos() {
    const res = await api<EventoStaff[]>('/staff/me/eventos')
    eventos.value = res
    return res
  }

  async function buscar(eventoId: string, busca: string) {
    const res = await api<InscricaoCheckin[]>(
      `/staff/me/eventos/${eventoId}/checkin?busca=${encodeURIComponent(busca)}`
    )
    resultados.value = res
    return res
  }

  async function confirmarEntrega(eventoId: string, inscricaoId: string) {
    const res = await api<InscricaoCheckin>(`/staff/me/eventos/${eventoId}/checkin/${inscricaoId}`, {
      method: 'POST'
    })
    const idx = resultados.value.findIndex((r) => r.id === inscricaoId)
    if (idx !== -1) resultados.value[idx] = { ...resultados.value[idx], kitEntregueEm: res.kitEntregueEm }
    return res
  }

  async function desfazerEntrega(eventoId: string, inscricaoId: string) {
    const res = await api<InscricaoCheckin>(`/staff/me/eventos/${eventoId}/checkin/${inscricaoId}`, {
      method: 'DELETE'
    })
    const idx = resultados.value.findIndex((r) => r.id === inscricaoId)
    if (idx !== -1) resultados.value[idx] = { ...resultados.value[idx], kitEntregueEm: res.kitEntregueEm }
    return res
  }

  return { eventos, resultados, fetchEventos, buscar, confirmarEntrega, desfazerEntrega }
}
