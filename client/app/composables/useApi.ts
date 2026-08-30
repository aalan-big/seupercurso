// useCookie() cria uma ref independente a cada chamada — instâncias diferentes
// (uma por composable) só se sincronizam entre si de forma assíncrona (via
// BroadcastChannel). Logo após um login, isso cria uma janela onde uma
// requisição pode sair sem o token porque a instância local ainda não "ouviu"
// a mudança. Por isso lemos o cookie direto do navegador a cada requisição,
// em vez de depender do valor reativo dessa instância específica.
function lerTokenDoCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)seupercurso_token=([^;]*)/)
  if (!match) return null
  try {
    return JSON.parse(decodeURIComponent(match[1]))
  } catch {
    return decodeURIComponent(match[1])
  }
}

export function useApi() {
  const config = useRuntimeConfig()

  let baseURL = config.public.apiBase as string
  if (typeof window !== 'undefined' && window.location.hostname) {
    baseURL = `http://${window.location.hostname}:3000`
  }

  return $fetch.create({
    baseURL,
    onRequest({ options }) {
      const token = import.meta.client ? lerTokenDoCookie() : useCookie<string | null>('seupercurso_token').value
      if (token) {
        options.headers = {
          ...(options.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token}`
        }
      }
    }
    // Não limpamos o token aqui em resposta a um 401 genérico: várias rotas
    // (ex: /clientes/me, /organizadores/me) retornam 401/404 normalmente pra
    // contas que ainda não completaram aquele cadastro, e derrubar a sessão
    // inteira por causa disso é agressivo demais — cada composable já trata
    // sua própria falha via .catch(). A validade da sessão em si é decidida
    // por quem chama /auth/me.
  })
}


