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
  const token = useCookie<string | null>('rotapass_organizer_token', { default: () => null })
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
    const res = await api<AuthUser>('/auth/me')
    user.value = res
    return res
  }

  function logout() {
    token.value = null
    user.value = null
  }

  return { token, user, register, login, fetchMe, logout }
}
