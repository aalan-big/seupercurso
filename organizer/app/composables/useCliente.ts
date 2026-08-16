export interface ClientePf {
  id: string
  clienteId: string
  nomeCompleto: string
  cpf: string
  dataNascimento: string
  genero: 'MASCULINO' | 'FEMININO' | 'OUTRO'
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

  return { cliente, createPessoaFisica, createPessoaJuridica, createEndereco, fetchMe }
}
