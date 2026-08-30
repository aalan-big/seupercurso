export interface ContatoPayload {
  nome: string
  email: string
  assunto?: string
  mensagem: string
}

export function useContato() {
  const api = useApi()

  async function enviarContato(payload: ContatoPayload) {
    return await api<{ sucesso: boolean; mensagem: string }>('/contato', {
      method: 'POST',
      body: payload
    })
  }

  return { enviarContato }
}
