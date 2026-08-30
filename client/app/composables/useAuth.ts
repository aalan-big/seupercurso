export interface AuthUser {
  id: string
  email: string
  status: string
  emailVerificado: boolean
  ultimoLogin: string | null
  createdAt: string
  updatedAt: string
}

interface AuthResponse {
  accessToken: string
  usuario: AuthUser
}

export interface RegistroCompletoPayload {
  email: string
  password: string
  pessoaFisica: {
    nomeCompleto: string
    cpf: string
    dataNascimento: string
    genero: 'MASCULINO' | 'FEMININO' | 'OUTRO'
    pcd: boolean
    celular: string
    nacionalidade: string
  }
  endereco: {
    cep: string
    logradouro: string
    numero: string
    complemento?: string
    bairro: string
    cidade: string
    estado: string
    pais: string
  }
}

export function useAuth() {
  const token = useCookie<string | null>('seupercurso_token', { default: () => null })
  const user = useState<AuthUser | null>('auth_user', () => null)
  const api = useApi()

  async function register(email: string, password: string) {
    const res = await api<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password }
    })
    token.value = res.accessToken
    user.value = res.usuario
    return res
  }

  async function registrarCompleto(payload: RegistroCompletoPayload) {
    const res = await api<AuthResponse>('/auth/registro-completo', {
      method: 'POST',
      body: payload
    })
    token.value = res.accessToken
    user.value = res.usuario
    return res
  }

  async function emailDisponivel(email: string) {
    const res = await api<{ disponivel: boolean }>('/auth/check-email', {
      method: 'POST',
      body: { email }
    })
    return res.disponivel
  }

  async function login(email: string, password: string) {
    const res = await api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    token.value = res.accessToken
    user.value = res.usuario
    return res
  }

  async function fetchMe() {
    const res = await api<AuthUser>('/auth/me')
    user.value = res
    return res
  }

  async function esqueciSenha(email: string) {
    return await api<{ sucesso: boolean; mensagem: string }>('/auth/esqueci-senha', {
      method: 'POST',
      body: { email }
    })
  }

  async function redefinirSenha(resetToken: string, novaSenha: string) {
    return await api<{ sucesso: boolean; mensagem: string }>('/auth/redefinir-senha', {
      method: 'POST',
      body: { token: resetToken, novaSenha }
    })
  }

  async function verificarEmail(emailToken: string) {
    return await api<{ sucesso: boolean; mensagem: string }>('/auth/verificar-email', {
      method: 'POST',
      body: { token: emailToken }
    })
  }

  async function reenviarVerificacao() {
    return await api<{ sucesso: boolean; mensagem: string }>('/auth/reenviar-verificacao', {
      method: 'POST'
    })
  }

  function logout() {
    token.value = null
    user.value = null
  }

  return {
    token,
    user,
    register,
    registrarCompleto,
    emailDisponivel,
    login,
    fetchMe,
    esqueciSenha,
    redefinirSenha,
    verificarEmail,
    reenviarVerificacao,
    logout
  }
}
