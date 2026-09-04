// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  devServer: { host: '0.0.0.0', port: 3001 },
  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1.0, viewport-fit=cover'
    }
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3000',
      organizerBase: process.env.NUXT_PUBLIC_ORGANIZER_BASE || 'http://localhost:3002',
      // Public key do Mercado Pago da plataforma, usada so como fallback: a
      // chave que vale e a do organizador do evento, buscada na API.
      //
      // O nome da chave importa. O Nuxt so sobrescreve runtimeConfig em tempo
      // de execucao pela variavel derivada dela (mpPublicKey ->
      // NUXT_PUBLIC_MP_PUBLIC_KEY). Com o nome antigo (mercadoPagoPublicKey)
      // seria preciso NUXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY, e definir a do PM2
      // nao surtia efeito nenhum: o checkout subia sem chave.
      mpPublicKey: process.env.NUXT_PUBLIC_MP_PUBLIC_KEY || ''
    }
  }
})

