export interface Dependente {
  id: string;
  clienteId: string;
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  genero: 'MASCULINO' | 'FEMININO' | 'OUTRO';
  pcd: boolean;
  celular?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useDependente() {
  const { token } = useAuth();
  const api = useApi();

  const dependentes = useState<Dependente[]>('dependentes', () => []);
  const carregando = useState<boolean>('dependentes-carregando', () => false);

  async function fetchDependentes() {
    if (!token.value) {
      dependentes.value = [];
      return [];
    }
    carregando.value = true;
    try {
      const res = await api<Dependente[]>('/dependentes');
      dependentes.value = Array.isArray(res) ? res : [];
      return dependentes.value;
    } catch (e: any) {
      dependentes.value = [];
      console.error('Erro ao buscar dependentes:', e);
      return [];
    } finally {
      carregando.value = false;
    }
  }

  async function criarDependente(dados: {
    nomeCompleto: string;
    cpf: string;
    dataNascimento: string;
    genero: 'MASCULINO' | 'FEMININO' | 'OUTRO';
    pcd?: boolean;
    celular?: string;
  }) {
    if (!token.value) throw new Error('Não autenticado.');
    const novo = await api<Dependente>('/dependentes', {
      method: 'POST',
      body: dados,
    });
    await fetchDependentes();
    return novo;
  }

  async function atualizarDependente(
    id: string,
    dados: Partial<{
      nomeCompleto: string;
      cpf: string;
      dataNascimento: string;
      genero: 'MASCULINO' | 'FEMININO' | 'OUTRO';
      pcd: boolean;
      celular: string;
    }>,
  ) {
    if (!token.value) throw new Error('Não autenticado.');
    const atualizado = await api<Dependente>(`/dependentes/${id}`, {
      method: 'PUT',
      body: dados,
    });
    await fetchDependentes();
    return atualizado;
  }

  async function excluirDependente(id: string) {
    if (!token.value) throw new Error('Não autenticado.');
    await api(`/dependentes/${id}`, {
      method: 'DELETE',
    });
    await fetchDependentes();
  }

  return {
    dependentes,
    carregando,
    fetchDependentes,
    criarDependente,
    atualizarDependente,
    excluirDependente,
  };
}
