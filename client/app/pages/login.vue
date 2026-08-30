<script setup lang="ts">
import { Footprints } from 'lucide-vue-next'

const { token, login } = useAuth()
const route = useRoute()

const destino = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

const form = reactive({ email: '', password: '' })
const mostrarSenha = ref(false)
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
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
          <Footprints :size="24" />
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
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Senha</label>
            <div class="relative">
              <input
                v-model="form.password"
                :type="mostrarSenha ? 'text' : 'password'"
                required
                class="w-full rounded-xl border border-slate-300 pl-4 pr-11 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
              />
              <button
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                title="Mostrar/Ocultar Senha"
                @click="mostrarSenha = !mostrarSenha"
              >
                <svg v-if="!mostrarSenha" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.03 10.03 0 013.122-.563c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m-6.165-6.165a3 3 0 004.243 4.243M3 3l18 18" />
                </svg>
              </button>
            </div>
          </div>
          <button
            type="submit"
            :disabled="carregando"
            class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          >
            Entrar
          </button>
        </form>

        <p class="mt-4 text-center text-sm text-slate-500">
          <NuxtLink to="/esqueci-senha" class="font-semibold text-secondary hover:underline">Esqueci minha senha</NuxtLink>
        </p>

        <p class="mt-2 text-center text-sm text-slate-500">
          Ainda não tem conta?
          <NuxtLink to="/cadastro" class="font-semibold text-secondary hover:underline">Cadastre-se</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
