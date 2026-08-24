export default defineNuxtPlugin(() => {
  const route = useRoute()
  const token = useCookie<string | null>('seupercurso_token', { default: () => null })
  const orgToken = useCookie<string | null>('rotapass_organizer_token', { default: () => null })

  if (route.query.token && typeof route.query.token === 'string') {
    token.value = route.query.token
    orgToken.value = route.query.token
  }
})
