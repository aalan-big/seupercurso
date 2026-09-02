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
  let controller: any = null

  async function montar(opcoes: {
    container: string
    valor: number
    email?: string
    maxParcelas?: number
    onPagar: (dados: DadosCartaoTokenizado) => Promise<void>
    onErro?: (mensagem: string) => void
  }) {
    const publicKey = config.public.mercadoPagoPublicKey as string

    if (!publicKey) {
      opcoes.onErro?.('Pagamento com cartão indisponível no momento.')
      return
    }

    await carregarSdk()
    await desmontar()

    const mp = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
    const bricks = mp.bricks()

    controller = await bricks.create('payment', opcoes.container, {
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
