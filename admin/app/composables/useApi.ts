export function useApi() {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>('rotapass_admin_token', { default: () => null })

  return $fetch.create({
    baseURL: config.public.apiBase,
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

