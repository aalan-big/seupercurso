export interface StaffUser {
  id: string
  nome: string
  email: string
  funcao: string | null
}

interface StaffAuthResponse {
  accessToken: string
  staff: StaffUser
}

export function useStaffAuth() {
  const token = useCookie<string | null>('rotapass_staff_token', { default: () => null })
  const staff = useState<StaffUser | null>('staff_auth_user', () => null)
  const api = useStaffApi()

  async function login(email: string, password: string) {
    const res = await api<StaffAuthResponse>('/staff-auth/login', {
      method: 'POST',
      body: { email, password }
    })
    token.value = res.accessToken
    staff.value = res.staff
    return res
  }

  function logout() {
    token.value = null
    staff.value = null
  }

  return { token, staff, login, logout }
}
