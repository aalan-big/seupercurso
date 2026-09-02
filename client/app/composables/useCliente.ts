export interface ClientePf {
  id: string
  clienteId: string
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  genero: 'MASCULINO' | 'FEMININO' | 'OUTRO'
  pcd: boolean
  documentoPcdUrl: string | null
  celular: string
  nacionalidade: string
}

export interface ClientePj {
  id: string
  clienteId: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  nomeResponsavel: string
  documentoResponsavel: string
  celularComercial: string
}

export interface Endereco {
  id: string
  clienteId: string
  tipo: string | null
  cep: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  estado: string
  pais: string
}

export interface Cliente {
  id: string
  usuarioId: string
  fotoPerfil: string | null
  status: string
  createdAt: string
  updatedAt: string
  pf: ClientePf | null
  pj: ClientePj | null
  enderecos?: Endereco[]
}

export interface CreateClientePfInput {
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  genero: 'MASCULINO' | 'FEMININO' | 'OUTRO'
  pcd?: boolean
  celular: string
  nacionalidade?: string
}

export interface CreateClientePjInput {
  razaoSocial: string
  nomeFantasia?: string
  cnpj: string
  nomeResponsavel: string
  documentoResponsavel: string
  celularComercial: string
}

export interface CreateEnderecoInput {
  tipo?: string
  cep: string
  logradouro: string
  numero: string
  complemento?: string
  bairro: string
  cidade: string
  estado: string
  pais?: string
}

/** O CPF nao entra aqui: trocar exige solicitacao com documento aprovada pelo admin. */
export interface UpdateClientePfInput {
  nomeCompleto?: string
  dataNascimento?: string
  genero?: 'MASCULINO' | 'FEMININO' | 'OUTRO'
  pcd?: boolean
  celular?: string
  nacionalidade?: string
}

export function useCliente() {
  const cliente = useState<Cliente | null>('cliente_perfil', () => null)
  const api = useApi()

  async function createPessoaFisica(input: CreateClientePfInput) {
    const res = await api<Cliente>('/clientes/me/pessoa-fisica', {
      method: 'POST',
      body: input
    })
    cliente.value = res
    return res
  }

  async function createPessoaJuridica(input: CreateClientePjInput) {
    const res = await api<Cliente>('/clientes/me/pessoa-juridica', {
      method: 'POST',
      body: input
    })
    cliente.value = res
    return res
  }

  async function fetchMe() {
    const res = await api<Cliente>('/clientes/me')
    cliente.value = res
    return res
  }

  async function createEndereco(input: CreateEnderecoInput) {
    return await api<Endereco>('/clientes/me/endereco', {
      method: 'POST',
      body: input
    })
  }

  async function updatePessoaFisica(input: UpdateClientePfInput) {
    const res = await api<ClientePf>('/clientes/me/pessoa-fisica', {
      method: 'PATCH',
      body: input
    })
    if (cliente.value) cliente.value = { ...cliente.value, pf: res }
    return res
  }

  async function updateEndereco(input: CreateEnderecoInput) {
    const res = await api<Endereco>('/clientes/me/endereco', {
      method: 'PATCH',
      body: input
    })
    if (cliente.value) cliente.value = { ...cliente.value, enderecos: [res] }
    return res
  }

  async function uploadFoto(arquivo: File) {
    const formData = new FormData()
    formData.append('foto', arquivo)
    const res = await api<{ fotoPerfil: string | null }>('/clientes/me/foto', {
      method: 'PATCH',
      body: formData
    })
    if (cliente.value) cliente.value = { ...cliente.value, fotoPerfil: res.fotoPerfil }
    return res
  }

  async function uploadDocumentoPcd(arquivo: File) {
    const formData = new FormData()
    formData.append('documento', arquivo)
    const res = await api<ClientePf>('/clientes/me/documento-pcd', {
      method: 'PATCH',
      body: formData
    })
    if (cliente.value) cliente.value = { ...cliente.value, pf: res }
    return res
  }

  return {
    cliente,
    createPessoaFisica,
    createPessoaJuridica,
    createEndereco,
    updatePessoaFisica,
    updateEndereco,
    uploadFoto,
    uploadDocumentoPcd,
    fetchMe
  }
}
