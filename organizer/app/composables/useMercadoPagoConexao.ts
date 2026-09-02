/**
 * Conexao da conta Mercado Pago do organizador.
 *
 * Diferente do Asaas, nao criamos conta para ninguem: o organizador autoriza a
 * nossa aplicacao e o dinheiro das inscricoes cai direto na conta dele.
 */
export function useMercadoPagoConexao() {
  const api = useApi()

  async function obterUrlAutorizacao() {
    return api<{ url: string }>('/organizadores/me/mercadopago/conexao')
  }

  async function concluirConexao(code: string, state: string) {
    return api<{ conectado: boolean; conectadoEm: string | null }>(
      '/organizadores/me/mercadopago/conexao',
      { method: 'POST', body: { code, state } }
    )
  }

  async function desconectar() {
    return api<{ conectado: boolean }>('/organizadores/me/mercadopago/conexao', {
      method: 'DELETE'
    })
  }

  return { obterUrlAutorizacao, concluirConexao, desconectar }
}
