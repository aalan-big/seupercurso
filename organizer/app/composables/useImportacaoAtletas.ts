// Importar atletas vendidos em outro site (planilha). So aparece no evento em
// que a equipe do Seu Percurso liberou a importacao.

export interface CategoriaImportacao {
  id: string
  nome: string
  modalidadeId: string
  modalidadeNome: string
  pcd: boolean
  servidorPublico: boolean
}

export interface GrupoImportacao {
  chave: string
  modalidade: string
  categoria: string
  quantidade: number
  sugestao: string | null
  destino: string | null
}

export interface LinhaImportacao {
  linha: number
  nome: string
  cpf: string
  dataNascimento: string
  genero: string
  tamanhoCamisa: string
  numeroPeito: string
  email: string
  modalidadeTexto: string
  categoriaTexto: string
  categoriaId: string | null
  categoriaNome: string | null
  modalidadeNome: string | null
  erros: string[]
  avisos: string[]
}

export interface PreviaImportacao {
  linhas: LinhaImportacao[]
  grupos: GrupoImportacao[]
  categorias: CategoriaImportacao[]
  resumo: { total: number; validas: number; comErro: number; comAviso: number }
}

export interface ImportacaoFeita {
  id: string
  siteOrigem: string
  nomeArquivo: string
  totalAtletas: number
  ativos: number
  kitsEntregues: number
  podeDesfazer: boolean
  desfeitaEm: string | null
  createdAt: string
}

export function useImportacaoAtletas() {
  const api = useApi()
  const base = (eventoId: string) => `/organizadores/me/eventos/${eventoId}/importacoes-atletas`

  async function listar(eventoId: string) {
    return api<{ liberada: boolean; importacoes: ImportacaoFeita[] }>(base(eventoId))
  }

  async function previa(eventoId: string, arquivo: File, mapeamento: Record<string, string>) {
    const form = new FormData()
    form.append('arquivo', arquivo)
    form.append('mapeamento', JSON.stringify(mapeamento))
    return api<PreviaImportacao>(`${base(eventoId)}/previa`, { method: 'POST', body: form })
  }

  async function confirmar(
    eventoId: string,
    arquivo: File,
    dados: { siteOrigem: string; mapeamento: Record<string, string>; esperados: number }
  ) {
    const form = new FormData()
    form.append('arquivo', arquivo)
    form.append('siteOrigem', dados.siteOrigem)
    form.append('autorizacaoAtletas', 'true')
    form.append('mapeamento', JSON.stringify(dados.mapeamento))
    form.append('esperados', String(dados.esperados))
    return api<{ importacaoId: string; importados: number; ignorados: number }>(base(eventoId), {
      method: 'POST',
      body: form
    })
  }

  async function desfazer(eventoId: string, importacaoId: string) {
    return api<{ canceladas: number }>(`${base(eventoId)}/${importacaoId}/desfazer`, { method: 'POST' })
  }

  /** Planilha modelo em CSV (abre no Excel), gerada aqui mesmo. */
  function baixarModelo() {
    const linhas = [
      'Nome;CPF;Data de nascimento;Sexo;Modalidade;Categoria;Camisa;Nº de peito;E-mail',
      'Maria da Silva;123.456.789-09;15/03/1990;F;5K;;M;101;maria@exemplo.com',
      'João Pereira;529.982.247-25;02/11/1985;M;10K;;G;;'
    ]
    // BOM para o Excel abrir os acentos certo
    const blob = new Blob([String.fromCharCode(0xfeff) + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-importar-atletas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return { listar, previa, confirmar, desfazer, baixarModelo }
}
