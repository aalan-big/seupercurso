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

  return {
    buscarInfo,
    gerarApiKey,
    importarCsv,
    listarResultados
  }
}
