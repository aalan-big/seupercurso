<script setup lang="ts">
const { token, login } = useAuth()
const route = useRoute()

const destino = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

const form = reactive({ email: '', password: '' })
const erro = ref('')
const carregando = ref(false)

const fotos = ['/hero-corrida.jpg', '/hero-moto.jpg', '/hero-ciclismo.jpg']
const fotoAtual = ref(0)
let intervaloFotos: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  if (token.value) {
    navigateTo(destino.value)
  }
  intervaloFotos = setInterval(() => {
    fotoAtual.value = (fotoAtual.value + 1) % fotos.length
  }, 4000)
})

onUnmounted(() => {
  clearInterval(intervaloFotos)
})

async function onSubmit() {
  erro.value = ''
  carregando.value = true
  try {
    await login(form.email, form.password)
    await navigateTo(destino.value)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="grid min-h-[80vh] grid-cols-1 md:grid-cols-2">
    <div class="relative hidden overflow-hidden md:block">
      <div
        v-for="(foto, i) in fotos"
        :key="foto"
        class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
        :class="i === fotoAtual ? 'opacity-100' : 'opacity-0'"
        :style="{ backgroundImage: `url(${foto})` }"
      ></div>
      <div class="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/70"></div>
      <div class="relative flex h-full flex-col justify-center px-12">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl backdrop-blur">
          🏃
        </span>
        <h2 class="mt-6 text-3xl font-extrabold uppercase leading-tight tracking-tight text-white">
          Sua próxima<br />conquista começa aqui
        </h2>
        <p class="mt-3 max-w-sm text-slate-200">
          Entre para acompanhar suas inscrições e encontrar novos desafios.
        </p>
      </div>
    </div>

    <div class="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
      <div class="mx-auto w-full max-w-sm">
        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Entrar</h1>
        <p class="mt-1 text-sm text-slate-500">Acesse sua conta pra se inscrever em eventos.</p>

        <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ erro }}
        </p>

        <form class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">E-mail</label>
            <input
              v-model="form.email"
              type="email"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Senha</label>
            <input
              v-model="form.password"
              type="password"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="submit"
            :disabled="carregando"
            class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          >
            Entrar
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-500">
          Ainda não tem conta?
          <NuxtLink to="/cadastro" class="font-semibold text-secondary hover:underline">Cadastre-se</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
