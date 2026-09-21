export interface AdminItem {
  id: string
  nome: string
  email: string
  createdAt: string
  updatedAt: string
}

export function useAdminGerenciamento() {
  const admins = useState<AdminItem[]>('admin_gerenciamento_lista', () => [])
  const carregando = ref(false)
  const api = useApi()

  async function listarAdmins() {
    carregando.value = true
    try {
      const res = await api<AdminItem[]>('/admin/administradores')
      admins.value = res
      return res
    } finally {
      carregando.value = false
    }
  }

  async function criarAdmin(dados: { nome: string; email: string; password: string }) {
    const res = await api<AdminItem>('/admin/administradores', {
      method: 'POST',
      body: dados
    })
    if (res?.id) {
      admins.value.push(res)
    }
    return res
  }

  return {
    admins,
    carregando,
    listarAdmins,
    criarAdmin
  }
}
