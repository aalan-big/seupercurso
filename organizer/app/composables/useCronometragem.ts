export interface CronometragemInfo {
  id: string
  nome: string
  apiKeyCronometragem: string | null
}

export interface ItemResultadoCronometragem {
  numeroPeito: string
  tempoLiquidoSegundos: number
  tempoBrutoSegundos?: number
  status?: string
}

export interface InscricaoComResultado {
  id: string
  numeroPeito: string | null
  tamanhoCamisa: string | null
  kitEntregueEm: string | null
  dataInscricao: string
  cliente: {
    id: string
    pf?: {
      nomeCompleto: string
      cpf: string
    } | null
  }
  categoria: {
    id: string
    nome: string
    modalidade: {
      id: string
      nome: string
      distanciaKm: number | string
    }
  }
  resultado: {
    id: string
    tempoLiquidoSegundos: number
    tempoBrutoSegundos: number
    colocacaoGeral?: number | null
    colocacaoCategoria?: number | null
    colocacaoGenero?: number | null
    status: string
  }
}

export interface SolicitacaoCronometragemItem {
  id: string
  cronometradora: {
    id: string
    nome: string
    documento?: string | null
  }
  status: 'pendente' | 'aprovada' | 'recusada' | 'revogada' | 'expirada'
  mensagem: string
  resposta?: string | null
  valida_ate?: string | null
  criada_em: string
  respondida_em?: string | null
}

export interface ResumoChipsCronometragem {
  totalChips: number
  totalInscritos: number
  inscritosComPeito: number
}

export function useCronometragem() {
  const api = useApi()

  async function buscarInfo(eventoId: string) {
    return api<CronometragemInfo>(`/eventos/${eventoId}/cronometragem/info`)
  }

  async function gerarApiKey(eventoId: string) {
    return api<CronometragemInfo>(`/eventos/${eventoId}/cronometragem/api-key`, { method: 'POST' })
  }

  async function importarCsv(eventoId: string, resultados: ItemResultadoCronometragem[]) {
    return api<{ totalRecebidos: number; processadosComSucesso: number }>(
      `/eventos/${eventoId}/cronometragem/importar-csv`,
      { method: 'POST', body: { resultados } }
    )
  }

  async function listarResultados(eventoId: string) {
    return api<InscricaoComResultado[]>(`/eventos/${eventoId}/cronometragem/resultados`)
  }

  async function listarSolicitacoes(eventoId: string) {
    return api<SolicitacaoCronometragemItem[]>(`/eventos/${eventoId}/cronometragem/solicitacoes`)
  }

  async function aprovarSolicitacao(solicitacaoId: string) {
    return api<{ status: string }>(`/cronometragem/solicitacoes/${solicitacaoId}/aprovar`, {
      method: 'POST',
    })
  }

  async function recusarSolicitacao(solicitacaoId: string, resposta?: string) {
    return api<{ status: string }>(`/cronometragem/solicitacoes/${solicitacaoId}/recusar`, {
      method: 'POST',
      body: { resposta },
    })
  }

  async function revogarSolicitacao(solicitacaoId: string) {
    return api<{ status: string }>(`/cronometragem/solicitacoes/${solicitacaoId}/revogar`, {
      method: 'POST',
    })
  }

  async function importarChips(
    eventoId: string,
    payload: { csvContent?: string; chips?: Array<{ numeroPeito: number; tagEpc: string }>; substituir?: boolean }
  ) {
    return api<{ sucesso: boolean; totalProcessados: number; substituidos: boolean }>(
      `/eventos/${eventoId}/cronometragem/chips/importar`,
      {
        method: 'POST',
        body: payload,
      }
    )
  }

  async function buscarResumoChips(eventoId: string) {
    return api<ResumoChipsCronometragem>(`/eventos/${eventoId}/cronometragem/chips`)
  }

  return {
    buscarInfo,
    gerarApiKey,
    importarCsv,
    listarResultados,
    listarSolicitacoes,
    aprovarSolicitacao,
    recusarSolicitacao,
    revogarSolicitacao,
    importarChips,
    buscarResumoChips,
  }
}
