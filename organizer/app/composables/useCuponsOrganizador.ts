export interface CupomOrganizador {
  id: string
  eventoId: string
  codigo: string
  percentualDesconto: string
  quantidadeMaxima: number | null
  usosAtuais: number
  validoAte: string | null
  ativo: boolean
  createdAt: string
}

export interface CupomInput {
  codigo: string
  percentualDesconto: number
  quantidadeMaxima?: number
  validoAte?: string
}

export function useCuponsOrganizador() {
  const cupons = useState<CupomOrganizador[]>('organizador_cupons', () => [])
  const api = useApi()

  async function fetchCupons(eventoId: string) {
    const res = await api<CupomOrganizador[]>(`/organizadores/me/eventos/${eventoId}/cupons`)
    cupons.value = res
    return res
  }

  async function criarCupom(eventoId: string, input: CupomInput) {
    await api(`/organizadores/me/eventos/${eventoId}/cupons`, { method: 'POST', body: input })
    await fetchCupons(eventoId)
  }

  async function removerCupom(eventoId: string, cupomId: string) {
    await api(`/organizadores/me/eventos/${eventoId}/cupons/${cupomId}`, { method: 'DELETE' })
    await fetchCupons(eventoId)
  }

  return { cupons, fetchCupons, criarCupom, removerCupom }
}
