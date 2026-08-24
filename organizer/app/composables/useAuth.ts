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

export function useAuth() {
  const tokenOrg = useCookie<string | null>('rotapass_organizer_token', { default: () => null })
  const tokenClient = useCookie<string | null>('seupercurso_token', { default: () => null })

  const token = computed({
    get: () => tokenOrg.value || tokenClient.value,
    set: (val) => {
      tokenOrg.value = val
      tokenClient.value = val
    }
  })

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
    try {
      const res = await api<AuthUser>('/auth/me')
      user.value = res
      return res
    } catch (e) {
      token.value = null
      user.value = null
      throw e
    }
  }

  function logout() {
    token.value = null
    user.value = null
  }

  async function alterarSenha(senhaAtual: string, novaSenha: string) {
    return await api('/auth/senha', {
      method: 'PATCH',
      body: { senhaAtual, novaSenha }
    })
  }

  return { token, user, register, login, fetchMe, logout, alterarSenha }
}
