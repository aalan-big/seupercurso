export function useApi() {
  const config = useRuntimeConfig()
  const tokenOrg = useCookie<string | null>('rotapass_organizer_token', { default: () => null })
  const tokenClient = useCookie<string | null>('seupercurso_token', { default: () => null })

  let baseURL = config.public.apiBase as string
  if (typeof window !== 'undefined' && window.location.hostname) {
    baseURL = `http://${window.location.hostname}:3000`
  }

  return $fetch.create({
    baseURL,
    onRequest({ options }) {
      const activeToken = tokenOrg.value || tokenClient.value
      if (activeToken) {
        options.headers = {
          ...(options.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${activeToken}`
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        tokenOrg.value = null
        tokenClient.value = null
      }
    }
  })
}



