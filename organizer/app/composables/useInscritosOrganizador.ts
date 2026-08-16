export interface InscritoOrganizador {
  id: string
  numeroPeito: string | null
  tamanhoCamisa: string | null
  dataInscricao: string
  status: 'PENDENTE_PAGAMENTO' | 'CONFIRMADA' | 'CANCELADA' | 'EXPIRADA'
  cliente: {
    usuario: { email: string }
    pf: { nomeCompleto: string; cpf: string; celular: string } | null
    pj: { razaoSocial: string; cnpj: string } | null
  }
  categoria: {
    nome: string
    modalidade: {
      nome: string
      evento: { id: string; nome: string }
    }
  }
}

export interface FiltrosInscritos {
  eventoId?: string
  status?: string
  busca?: string
}

function paraQueryString(filtros: FiltrosInscritos) {
  const params = new URLSearchParams()
  if (filtros.eventoId) params.set('eventoId', filtros.eventoId)
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.busca) params.set('busca', filtros.busca)
  const query = params.toString()
  return query ? `?${query}` : ''
}

export function useInscritosOrganizador() {
  const inscritos = useState<InscritoOrganizador[]>('organizador_inscritos', () => [])
  const api = useApi()

  async function fetchInscritos(filtros: FiltrosInscritos = {}) {
    const res = await api<InscritoOrganizador[]>(`/organizadores/me/inscritos${paraQueryString(filtros)}`)
    inscritos.value = res
    return res
  }

  async function exportarCsv(filtros: FiltrosInscritos = {}) {
    const blob = await api<Blob>(`/organizadores/me/inscritos/exportar${paraQueryString(filtros)}`, {
      responseType: 'blob'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inscritos.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return { inscritos, fetchInscritos, exportarCsv }
}
