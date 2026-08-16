export interface ResultadoOrganizador {
  id: string
  inscricaoId: string
  tempoBrutoSegundos: number | null
  tempoLiquidoSegundos: number | null
  colocacaoGeral: number | null
  colocacaoCategoria: number | null
  colocacaoGenero: number | null
  status: 'FINALIZADO' | 'DNF' | 'DNS' | 'DESCLASSIFICADO'
  inscricao: {
    numeroPeito: string | null
    cliente: { pf: { nomeCompleto: string } | null }
    categoria: { nome: string }
    certificado: { id: string } | null
  }
}

export interface ImportarResultadosResposta {
  totalLinhas: number
  processados: number
  erros: { linha: number; motivo: string }[]
}

export function useResultadosOrganizador() {
  const resultados = useState<ResultadoOrganizador[]>('organizador_resultados', () => [])
  const api = useApi()

  async function fetchResultados(eventoId: string) {
    const res = await api<ResultadoOrganizador[]>(`/organizadores/me/eventos/${eventoId}/resultados`)
    resultados.value = res
    return res
  }

  async function importarResultados(eventoId: string, arquivo: File) {
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    const res = await api<ImportarResultadosResposta>(
      `/organizadores/me/eventos/${eventoId}/resultados/importar`,
      { method: 'POST', body: formData }
    )
    await fetchResultados(eventoId)
    return res
  }

  async function gerarCertificados(eventoId: string) {
    const res = await api<{ gerados: number }>(`/organizadores/me/eventos/${eventoId}/certificados/gerar`, {
      method: 'POST'
    })
    await fetchResultados(eventoId)
    return res
  }

  return { resultados, fetchResultados, importarResultados, gerarCertificados }
}
