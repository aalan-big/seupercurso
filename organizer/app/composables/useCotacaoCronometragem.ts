export type SituacaoCotacao =
  | 'SOLICITADA'
  | 'ORCADA'
  | 'ACEITA'
  | 'RECUSADA'
  | 'CANCELADA'
  | 'PAGA'
  | 'CONCLUIDA'
  | 'EXPIRADA'

export interface CotacaoCronometragem {
  id: string
  eventoId: string
  status: Exclude<SituacaoCotacao, 'EXPIRADA'>
  /** Status ja considerando proposta vencida (EXPIRADA). */
  situacao: SituacaoCotacao
  servicos: string[]
  atletasEstimados: number | null
  pontosPassagem: number | null
  observacoes: string | null
  valor: string | null
  descricaoProposta: string | null
  propostaValidaAte: string | null
  pagamentoAte: string | null
  comprovanteUrl: string | null
  comprovanteEnviadoEm: string | null
  pagaEm: string | null
  motivo: string | null
  createdAt: string
  /** So vem enquanto a proposta esta aceita e aguardando pagamento. */
  dadosPagamento: string | null
  evento: { id: string; nome: string; dataInicio: string; dataFim: string }
}

export interface SolicitarCotacaoInput {
  servicos: string[]
  atletasEstimados?: number
  pontosPassagem?: number
  observacoes?: string
}

// Mesmas chaves do servidor (cotacao-cronometragem/servicos.ts).
export const SERVICOS_CRONOMETRAGEM: { chave: string; rotulo: string }[] = [
  { chave: 'CHIP', rotulo: 'Chip descartável' },
  { chave: 'TAPETE', rotulo: 'Tapetes de leitura' },
  { chave: 'PORTICO', rotulo: 'Pórtico de largada/chegada' },
  { chave: 'PONTO_PASSAGEM', rotulo: 'Pontos de passagem (parciais)' },
  { chave: 'RESULTADO_ONLINE', rotulo: 'Resultado online' },
  { chave: 'CERTIFICADO', rotulo: 'Certificado digital' }
]

export function rotuloServico(chave: string) {
  return SERVICOS_CRONOMETRAGEM.find((s) => s.chave === chave)?.rotulo ?? chave
}

export function useCotacaoCronometragem() {
  const api = useApi()
  const base = '/organizadores/me/cotacoes-cronometragem'

  function listar() {
    return api<CotacaoCronometragem[]>(base)
  }

  function solicitar(eventoId: string, input: SolicitarCotacaoInput) {
    return api<CotacaoCronometragem>(`/organizadores/me/eventos/${eventoId}/cotacoes-cronometragem`, {
      method: 'POST',
      body: input
    })
  }

  function aceitar(id: string) {
    return api<CotacaoCronometragem>(`${base}/${id}/aceitar`, { method: 'POST' })
  }

  function recusar(id: string, motivo?: string) {
    return api<CotacaoCronometragem>(`${base}/${id}/recusar`, { method: 'POST', body: { motivo } })
  }

  function cancelar(id: string, motivo?: string) {
    return api<CotacaoCronometragem>(`${base}/${id}/cancelar`, { method: 'POST', body: { motivo } })
  }

  function enviarComprovante(id: string, arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    return api<CotacaoCronometragem>(`${base}/${id}/comprovante`, { method: 'POST', body: formData })
  }

  return { listar, solicitar, aceitar, recusar, cancelar, enviarComprovante }
}
