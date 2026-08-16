export interface AdminUser {
  id: string
  email: string
  nome: string
  createdAt: string
  updatedAt: string
}

interface AuthResponse {
  accessToken: string
  admin: AdminUser
}

export function useAuth() {
  const token = useCookie<string | null>('rotapass_admin_token', { default: () => null })
  const user = useState<AdminUser | null>('admin_auth_user', () => null)
  const api = useApi()

  async function login(email: string, password: string) {
    const res = await api<AuthResponse>('/admin/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    token.value = res.accessToken
    user.value = res.admin
    return res
  }

  async function fetchMe() {
    const res = await api<AdminUser>('/admin/auth/me')
    user.value = res
    return res
  }

  function logout() {
    token.value = null
    user.value = null
  }

  return { token, user, login, fetchMe, logout }
}
