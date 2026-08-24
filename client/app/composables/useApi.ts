export function useApi() {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('seupercurso_token', { default: () => null })

  let baseURL = config.public.apiBase as string
  if (typeof window !== 'undefined' && window.location.hostname) {
    baseURL = `http://${window.location.hostname}:3000`
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


