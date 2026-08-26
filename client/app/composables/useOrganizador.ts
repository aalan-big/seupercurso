export interface Organizador {
  id: string
  clienteId: string
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'
  plano: string | null
  comissaoPercentual: string
  chavePix: string | null
  banco: string | null
  agencia: string | null
  conta: string | null
  fotoRostoUrl: string | null
  documentoIdentidadeUrl: string | null
  motivoRevisao: string | null
  createdAt: string
  updatedAt: string
}

export function useOrganizador() {
  const organizador = useState<Organizador | null>('organizador_perfil', () => null)
  const api = useApi()

  async function fetchMe() {
    const res = await api<Organizador>('/organizadores/me')
    organizador.value = res
    return res
  }

  return { organizador, fetchMe }
}
