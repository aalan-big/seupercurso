export interface KitsPorModalidade {
  modalidadeId: string
  modalidade: string
  tamanhos: Record<string, number>
}

export interface KitsPorModelo {
  modeloId: string
  modeloNome: string
  tamanhos: Record<string, number>
  total: number
}

export interface KitsResumo {
  total: number
  totalComCamisa?: number
  totalSemCamisa?: number
  totalPorTamanho: Record<string, number>
  porModelo?: KitsPorModelo[]
  porModalidade: KitsPorModalidade[]
}

export function useKitsOrganizador() {
  const kits = useState<KitsResumo | null>('organizador_kits', () => null)
  const api = useApi()

  async function fetchKits(eventoId: string) {
    const res = await api<KitsResumo>(`/organizadores/me/eventos/${eventoId}/kits`)
    kits.value = res
    return res
  }

  async function gerarNumeracaoPeito(eventoId: string, numeroInicial: number = 101) {
    return await api<{ totalNumerados: number; numeroInicial: number; numeroFinal: number }>(
      `/organizadores/me/eventos/${eventoId}/gerar-numeracao-peito`,
      {
        method: 'POST',
        body: { numeroInicial }
      }
    )
  }

  return { kits, fetchKits, gerarNumeracaoPeito }
}
