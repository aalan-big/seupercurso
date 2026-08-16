export interface OrganizadorClientePf {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  genero: string
  celular: string
  nacionalidade: string
}

export interface OrganizadorClientePj {
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  nomeResponsavel: string
  documentoResponsavel: string
  celularComercial: string
}

export interface OrganizadorEndereco {
  cep: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  estado: string
  pais: string
}

export interface OrganizadorAdmin {
  id: string
  status: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'
  comissaoPercentual: string
  documentoIdentidadeUrl: string | null
  motivoRevisao: string | null
  createdAt: string
  updatedAt: string
  cliente: {
    usuario: { email: string }
    pf: OrganizadorClientePf | null
    pj: OrganizadorClientePj | null
    enderecos: OrganizadorEndereco[]
  }
}

export function useAdminOrganizadores() {
  const organizadores = useState<OrganizadorAdmin[]>('admin_organizadores', () => [])
  const api = useApi()

  async function fetchLista(status?: string) {
    const res = await api<OrganizadorAdmin[]>('/admin/organizadores', {
      query: status ? { status } : undefined
    })
    organizadores.value = res
    return res
  }

  async function buscar(id: string) {
    return api<OrganizadorAdmin>(`/admin/organizadores/${id}`)
  }

  async function aprovar(id: string) {
    return api<OrganizadorAdmin>(`/admin/organizadores/${id}/aprovar`, { method: 'POST' })
  }

  async function rejeitar(id: string, motivo?: string) {
    return api<OrganizadorAdmin>(`/admin/organizadores/${id}/rejeitar`, {
      method: 'POST',
      body: { motivo }
    })
  }

  async function suspender(id: string, motivo?: string) {
    return api<OrganizadorAdmin>(`/admin/organizadores/${id}/suspender`, {
      method: 'POST',
      body: { motivo }
    })
  }

  return { organizadores, fetchLista, buscar, aprovar, rejeitar, suspender }
}
