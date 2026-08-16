export interface KitsPorModalidade {
  modalidadeId: string
  modalidade: string
  tamanhos: Record<string, number>
}

export interface KitsResumo {
  total: number
  totalPorTamanho: Record<string, number>
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

  return { kits, fetchKits }
}
