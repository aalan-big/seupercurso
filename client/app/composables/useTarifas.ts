export interface OpcaoParcelamento {
  num: number
  total: number
  parcela: number
}

export interface TabelaTarifas {
  pix: { percentual: number; fixo: number }
  cartao: { percentual: number; fixo: number }
  maxParcelas: number
  valorMinimoParcela: number
  /** Presentes quando `valorBase` e informado. */
  pixTotal?: number
  pixTarifa?: number
  parcelamento?: OpcaoParcelamento[]
}

/**
 * Tarifas do gateway vindas do servidor.
 *
 * A formula do acrescimo ficava repetida no checkout e no modal de pagamento,
 * e o PIX nao repassava tarifa nenhuma. Agora existe uma fonte so, e mudar de
 * gateway ou renegociar tarifa nao exige mexer no front.
 */
export function useTarifas() {
  const api = useApi()

  async function buscar(valorBase?: number) {
    return api<TabelaTarifas>('/pagamentos/tarifas', {
      query: valorBase && valorBase > 0 ? { valorBase } : undefined
    })
  }

  return { buscar }
}
