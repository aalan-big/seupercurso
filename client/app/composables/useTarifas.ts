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
  /** Comissao repassada ao atleta, quando o organizador escolheu nao absorve-la. */
  taxaServico?: number
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

  /**
   * @param baseComissao preco antes do cupom, quando difere do valorBase: a
   *   taxa do site sai dele. Omitido, a consulta e exatamente a de antes.
   */
  async function buscar(valorBase?: number, eventoId?: string, baseComissao?: number) {
    const temBase = !!valorBase && valorBase > 0
    const temBaseComissao = baseComissao !== undefined && baseComissao > 0
    return api<TabelaTarifas>('/pagamentos/tarifas', {
      query: temBase || temBaseComissao
        ? {
            valorBase: valorBase || 0,
            eventoId,
            ...(baseComissao !== undefined ? { baseComissao } : {})
          }
        : undefined
    })
  }

  return { buscar }
}
