export type SituacaoCotacaoAdmin =
  | 'SOLICITADA'
  | 'ORCADA'
  | 'ACEITA'
  | 'RECUSADA'
  | 'CANCELADA'
  | 'PAGA'
  | 'CONCLUIDA'
  | 'EXPIRADA'

export interface CotacaoCronometragemAdmin {
  id: string
  eventoId: string
  status: Exclude<SituacaoCotacaoAdmin, 'EXPIRADA'>
  /** Status ja considerando proposta vencida (EXPIRADA). */
  situacao: SituacaoCotacaoAdmin
  servicos: string[]
  atletasEstimados: number | null
  pontosPassagem: number | null
  observacoes: string | null
  valor: string | null
  descricaoProposta: string | null
  propostaValidaAte: string | null
  pagamentoAte: string | null
  propostaEnviadaEm: string | null
  aceitaEm: string | null
  comprovanteUrl: string | null
  comprovanteEnviadoEm: string | null
  pagaEm: string | null
  concluidaEm: string | null
  motivo: string | null
  createdAt: string
  /** So no detalhe. */
  inscritosConfirmados?: number
  evento: {
    id: string
    nome: string
    dataInicio: string
    dataFim: string
    local: string
    cidade: string
    estado: string
    status: string
    modalidades?: { nome: string; distanciaKm: string | null }[]
  }
  cronometradora: { id: string; nome: string } | null
  organizador: {
    id: string
    cliente: {
      usuario: { email: string }
      pf: { nomeCompleto: string; celular: string | null } | null
      pj: { razaoSocial: string; celularComercial: string | null } | null
    }
  }
}

export interface PropostaCotacaoInput {
  valor: number
  descricao: string
  /** AAAA-MM-DD */
  propostaValidaAte: string
  /** AAAA-MM-DD */
  pagamentoAte: string
}

export const ROTULO_SERVICO_CRONOMETRAGEM: Record<string, string> = {
  CHIP: 'Chip descartável',
  TAPETE: 'Tapetes de leitura',
  PORTICO: 'Pórtico de largada/chegada',
  PONTO_PASSAGEM: 'Pontos de passagem (parciais)',
  RESULTADO_ONLINE: 'Resultado online',
  CERTIFICADO: 'Certificado digital'
}

export function useAdminCotacaoCronometragem() {
  const api = useApi()
  const base = '/admin/cotacoes-cronometragem'

  function listar(status?: string) {
    return api<CotacaoCronometragemAdmin[]>(base, { query: status ? { status } : undefined })
  }

  function buscar(id: string) {
    return api<CotacaoCronometragemAdmin>(`${base}/${id}`)
  }

  function enviarProposta(id: string, input: PropostaCotacaoInput) {
    return api<CotacaoCronometragemAdmin>(`${base}/${id}/proposta`, { method: 'POST', body: input })
  }

  function confirmarPagamento(id: string, cronometradoraId?: string) {
    return api<CotacaoCronometragemAdmin>(`${base}/${id}/confirmar-pagamento`, {
      method: 'POST',
      body: cronometradoraId ? { cronometradoraId } : {}
    })
  }

  function concluir(id: string) {
    return api<CotacaoCronometragemAdmin>(`${base}/${id}/concluir`, { method: 'POST' })
  }

  function cancelar(id: string, motivo?: string) {
    return api<CotacaoCronometragemAdmin>(`${base}/${id}/cancelar`, { method: 'POST', body: { motivo } })
  }

  function obterDadosPagamento() {
    return api<{ dados: string | null }>('/admin/configuracoes/pagamento-cronometragem')
  }

  function salvarDadosPagamento(dados: string) {
    return api<{ dados: string | null }>('/admin/configuracoes/pagamento-cronometragem', {
      method: 'PUT',
      body: { dados }
    })
  }

  return {
    listar,
    buscar,
    enviarProposta,
    confirmarPagamento,
    concluir,
    cancelar,
    obterDadosPagamento,
    salvarDadosPagamento
  }
}
