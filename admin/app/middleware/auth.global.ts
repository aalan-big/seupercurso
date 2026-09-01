export default defineNuxtRouteMiddleware((to) => {
  const token = useCookie<string | null>('rotapass_admin_token')

  const rotasPublicas = ['/login']
  const publica = rotasPublicas.includes(to.path)

  if (!token.value && !publica) {
    return navigateTo('/login')
  }

  if (token.value && publica) {
    return navigateTo('/dashboard')
  }
})
