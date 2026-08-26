export interface SolicitacaoArte {
  id: string
  status: 'PENDENTE_PAGAMENTO' | 'PAGO' | 'EM_PRODUCAO' | 'ENTREGUE' | 'CANCELADO'
  valor: string
  observacoes: string | null
  pixCopiaECola: string | null
  pixQrCodeUrl: string | null
  arquivoEntregueUrl: string | null
  motivoCancelamento: string | null
  createdAt: string
  evento: { id: string; nome: string }
}

export interface PrecoArte {
  precoArteEvento: string
}

export function useSolicitacaoArte() {
  const minhas = useState<SolicitacaoArte[]>('organizador_solicitacoes_arte', () => [])
  const api = useApi()

  async function obterPreco() {
    return api<PrecoArte>('/organizadores/me/arte/preco')
  }

  async function solicitar(eventoId: string, observacoes?: string) {
    return api<SolicitacaoArte>(`/organizadores/me/eventos/${eventoId}/solicitar-arte`, {
      method: 'POST',
      body: { observacoes }
    })
  }

  async function fetchMinhas() {
    const res = await api<SolicitacaoArte[]>('/organizadores/me/solicitacoes-arte')
    minhas.value = res
    return res
  }

  function solicitacaoDoEvento(eventoId: string) {
    return minhas.value.find((s) => s.evento.id === eventoId)
  }

  return { minhas, obterPreco, solicitar, fetchMinhas, solicitacaoDoEvento }
}
