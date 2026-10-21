// Aba aberta antes de um deploy ainda roda o JS antigo e, ao navegar, pede um
// arquivo /_nuxt/*.js que o novo build apagou. No Safari isso vira "Importing
// a module script failed" e o Nuxt mostra a tela de erro 500. Aqui recarrega a
// pagina de destino, que vem com o build novo. O reloadNuxtApp nao repete o
// reload dentro de 10s, entao nao entra em loop se o arquivo faltar de verdade.
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  let destino: string | null = null

  router.beforeEach((to) => {
    destino = to.fullPath
  })

  nuxtApp.hook('app:chunkError', () => {
    reloadNuxtApp({ path: destino ?? router.currentRoute.value.fullPath, persistState: true })
  })
})
