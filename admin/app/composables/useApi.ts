export function useApi() {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('rotapass_admin_token', { default: () => null })

  let baseURL = (config.public.apiBase as string) || 'http://localhost:3000'
  if (typeof window !== 'undefined' && window.location.hostname) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      baseURL = `http://${window.location.hostname}:3000`
    } else {
      baseURL = (config.public.apiBase as string) || 'https://api.seupercurso.esp.br'
    }
  }

  return $fetch.create({
    baseURL,
    onRequest({ options }) {
      if (token.value) {
        options.headers = {
          ...(options.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${token.value}`
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        token.value = null
      }
    }
  })
}


