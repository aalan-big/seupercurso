export interface StaffMembro {
  id: string
  nome: string
  email: string
  funcao: string | null
  ativo: boolean
  createdAt: string
}

export interface CreateStaffInput {
  nome: string
  email: string
  senha: string
  funcao?: string
}

export interface UpdateStaffInput {
  nome?: string
  funcao?: string
  ativo?: boolean
}

export function useStaff() {
  const membros = useState<StaffMembro[]>('organizador_staff', () => [])
  const api = useApi()

  async function fetchLista() {
    const res = await api<StaffMembro[]>('/organizadores/me/staff')
    membros.value = res
    return res
  }

  async function criar(input: CreateStaffInput) {
    const res = await api<StaffMembro>('/organizadores/me/staff', {
      method: 'POST',
      body: input
    })
    membros.value = [...membros.value, res]
    return res
  }

  async function atualizar(id: string, input: UpdateStaffInput) {
    const res = await api<StaffMembro>(`/organizadores/me/staff/${id}`, {
      method: 'PATCH',
      body: input
    })
    const idx = membros.value.findIndex((m) => m.id === id)
    if (idx !== -1) membros.value[idx] = res
    return res
  }

  async function redefinirSenha(id: string, novaSenha: string) {
    return api(`/organizadores/me/staff/${id}/senha`, {
      method: 'PATCH',
      body: { novaSenha }
    })
  }

  async function remover(id: string) {
    await api(`/organizadores/me/staff/${id}`, { method: 'DELETE' })
    membros.value = membros.value.filter((m) => m.id !== id)
  }

  return { membros, fetchLista, criar, atualizar, redefinirSenha, remover }
}
