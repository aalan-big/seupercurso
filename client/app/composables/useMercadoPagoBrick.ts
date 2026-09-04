declare global {
  interface Window {
    MercadoPago?: any
  }
}

let scriptCarregado: Promise<void> | null = null

/**
 * Carrega o SDK do Mercado Pago uma unica vez por sessao.
 * Varias telas usam o Brick; sem isso o script entraria duas vezes.
 */
function carregarSdk(): Promise<void> {
  if (scriptCarregado) return scriptCarregado

  scriptCarregado = new Promise((resolve, reject) => {
    if (window.MercadoPago) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptCarregado = null
      reject(new Error('Não foi possível carregar o pagamento. Verifique sua conexão.'))
    }
    document.head.appendChild(script)
  })

  return scriptCarregado
}

/**
 * Chave ja resolvida de cada evento.
 *
 * O Brick e remontado a cada mudanca de valor ou de parcelamento; sem cache
 * cada remontagem bateria de novo na API para receber a mesma chave. So o
 * sucesso entra aqui: guardar a ausencia deixaria o cartao desligado pelo resto
 * da sessao mesmo depois de o organizador conectar a conta.
 */
const chavePorEvento = new Map<string, string>()

export interface DadosCartaoTokenizado {
  tokenCartao: string
  metodoBandeira?: string
  emissor?: string
  parcelas: number
}

/**
 * Payment Brick do Mercado Pago para cartao de credito.
 *
 * O cartao e tokenizado no navegador: numero, validade e CVV nunca passam pelo
 * nosso servidor, que recebe apenas o token.
 */
export function useMercadoPagoBrick() {
  const config = useRuntimeConfig()
  const api = useApi()
  let controller: any = null

  /**
   * Cada evento cobra na conta do seu organizador, e o token do cartao so vale
   * na conta que o emitiu. Por isso a chave vem da API, por evento, e nao de
   * uma constante do build: com a chave da plataforma o Mercado Pago recusaria
   * o pagamento de todo evento de terceiro.
   */
  async function resolverChave(eventoId?: string): Promise<string | null> {
    if (!eventoId) return (config.public.mpPublicKey as string) || null

    const emCache = chavePorEvento.get(eventoId)
    if (emCache) return emCache

    const { publicKey } = await api<{ publicKey: string | null }>(
      '/pagamentos/chave-publica',
      { query: { eventoId } }
    )

    if (publicKey) chavePorEvento.set(eventoId, publicKey)
    return publicKey || null
  }

  async function montar(opcoes: {
    /** Id do elemento, sem `#`: o SDK recusa seletor CSS. */
    container: string
    valor: number
    /** Evento da cobranca; define de qual conta e a chave de tokenizacao. */
    eventoId?: string
    email?: string
    maxParcelas?: number
    onPagar: (dados: DadosCartaoTokenizado) => Promise<void>
    onErro?: (mensagem: string) => void
  }) {
    let publicKey: string | null
    try {
      publicKey = await resolverChave(opcoes.eventoId)
    } catch {
      opcoes.onErro?.(
        'Não foi possível preparar o pagamento com cartão. Tente novamente ou pague no PIX.'
      )
      return
    }

    if (!publicKey) {
      opcoes.onErro?.(
        'O organizador deste evento ainda não habilitou o pagamento com cartão. Você pode pagar no PIX.'
      )
      return
    }

    // Uma falha aqui (SDK bloqueado, chave recusada, valor invalido) rejeitava
    // a promise sem passar pelo onErro: o `callbacks.onError` do Brick so vale
    // depois que ele monta. O atleta ficava olhando um retangulo em branco, sem
    // motivo nem instrucao.
    try {
      await carregarSdk()
      await desmontar()

      const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
      const bricks = mp.bricks()

      // O SDK quer o id cru e recusa seletor: passar '#brick-cartao' fazia o
      // create() rejeitar com "Remove the '#' from target". Normalizar aqui
      // evita que a proxima tela repita o engano.
      const alvo = opcoes.container.replace(/^#/, '')

      controller = await bricks.create('payment', alvo, {
        initialization: {
          amount: Number(opcoes.valor.toFixed(2)),
          ...(opcoes.email ? { payer: { email: opcoes.email } } : {})
        },
        customization: {
          paymentMethods: {
            // PIX tem fluxo proprio na nossa tela; aqui e so cartao.
            creditCard: 'all',
            maxInstallments: opcoes.maxParcelas ?? 12
          },
          visual: { style: { theme: 'default' } }
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async ({ formData }: any) => {
            await opcoes.onPagar({
              tokenCartao: formData.token,
              metodoBandeira: formData.payment_method_id,
              emissor: formData.issuer_id ? String(formData.issuer_id) : undefined,
              parcelas: Number(formData.installments || 1)
            })
          },
          onError: (erro: any) => {
            opcoes.onErro?.(
              erro?.message || 'Não foi possível processar o cartão. Confira os dados.'
            )
          }
        }
      })
    } catch (erro: any) {
      console.error('[MercadoPago] falha ao montar o Payment Brick:', erro)
      opcoes.onErro?.(
        erro?.message
          ? `Não foi possível abrir o formulário de cartão: ${erro.message}`
          : 'Não foi possível abrir o formulário de cartão. Tente novamente ou pague no PIX.'
      )
    }
  }

  async function desmontar() {
    if (controller?.unmount) {
      try {
        await controller.unmount()
      } catch {
        // Brick ja removido; nada a fazer.
      }
    }
    controller = null
  }

  onBeforeUnmount(desmontar)

  return { montar, desmontar }
}
