export interface OpcoesConfirmacao {
  titulo: string
  mensagem: string
  textoConfirmar?: string
  textoCancelar?: string
  /** Botao de confirmar em vermelho, para exclusoes. */
  perigo?: boolean
  /** So um botao de "Entendi": substitui o alert() do navegador. */
  somenteAviso?: boolean
}

interface EstadoConfirmacao extends OpcoesConfirmacao {
  aberto: boolean
}

// O resolver fica fora do useState: funcao nao serializa e so existe no
// navegador, que e onde o dialogo abre.
let resolverAtual: ((ok: boolean) => void) | null = null

/**
 * Substitui confirm()/alert() do navegador por um dialogo no visual do painel.
 * Mesmo fluxo de antes: `if (!(await confirmar({...}))) return`.
 * O componente <ConfirmacaoDialog /> fica montado uma vez no app.vue.
 */
export function useConfirmacao() {
  const estado = useState<EstadoConfirmacao>('confirmacao-dialogo', () => ({
    aberto: false,
    titulo: '',
    mensagem: ''
  }))

  function abrir(opcoes: OpcoesConfirmacao): Promise<boolean> {
    // Um dialogo por vez: se outro estava aberto, conta como cancelado.
    resolverAtual?.(false)
    estado.value = { ...opcoes, aberto: true }
    return new Promise((resolve) => {
      resolverAtual = resolve
    })
  }

  function confirmar(opcoes: OpcoesConfirmacao) {
    return abrir(opcoes)
  }

  async function avisar(titulo: string, mensagem: string) {
    await abrir({ titulo, mensagem, somenteAviso: true, textoConfirmar: 'Entendi' })
  }

  function responder(ok: boolean) {
    estado.value = { ...estado.value, aberto: false }
    const resolver = resolverAtual
    resolverAtual = null
    resolver?.(ok)
  }

  return { estado, confirmar, avisar, responder }
}
