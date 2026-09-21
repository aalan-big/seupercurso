export interface UsuarioClientePf {
  nomeCompleto: string
  cpf: string
  celular: string | null
}

export interface UsuarioClientePj {
  razaoSocial: string
  cnpj: string
  celularComercial: string | null
}

export interface UsuarioInscricaoResumo {
  id: string
  status: string
  categoria: {
    nome: string
    modalidade: {
      evento: {
        nome: string
      }
    }
  }
}

export interface UsuarioAdmin {
  id: string
  email: string
  emailVerificado: boolean
  status: string
  createdAt: string
  cliente: {
    id: string
    pf: UsuarioClientePf | null
    pj: UsuarioClientePj | null
    _count: {
      inscricoes: number
    }
    inscricoes: UsuarioInscricaoResumo[]
  } | null
}

export function useAdminUsuarios() {
  const usuarios = useState<UsuarioAdmin[]>('admin_usuarios', () => [])
  const api = useApi()

  async function buscarUsuarios(busca?: string) {
    const res = await api<UsuarioAdmin[]>('/admin/usuarios', {
      query: busca ? { busca } : undefined
    })
    usuarios.value = res
    return res
  }

  async function verificarEmail(id: string) {
    const res = await api<{ id: string; email: string; emailVerificado: boolean }>(
      `/admin/usuarios/${id}/verificar-email`,
      { method: 'POST' }
    )
    const idx = usuarios.value.findIndex((u) => u.id === id)
    if (idx !== -1) {
      usuarios.value[idx].emailVerificado = true
    }
    return res
  }

  async function alterarEmail(id: string, novoEmail: string) {
    const res = await api<{ id: string; email: string; emailVerificado: boolean }>(
      `/admin/usuarios/${id}/email`,
      {
        method: 'PATCH',
        body: { email: novoEmail }
      }
    )
    const idx = usuarios.value.findIndex((u) => u.id === id)
    if (idx !== -1) {
      usuarios.value[idx].email = res.email
      usuarios.value[idx].emailVerificado = true
    }
    return res
  }

  return {
    usuarios,
    buscarUsuarios,
    verificarEmail,
    alterarEmail
  }
}
