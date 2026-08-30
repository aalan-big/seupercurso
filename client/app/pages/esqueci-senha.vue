<script setup lang="ts">
import { Footprints } from 'lucide-vue-next'

const { esqueciSenha } = useAuth()

const email = ref('')
const erro = ref('')
const enviado = ref(false)
const carregando = ref(false)

async function onSubmit() {
  erro.value = ''
  carregando.value = true
  try {
    await esqueciSenha(email.value)
    enviado.value = true
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
      <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url(/hero-corrida.jpg)` }"></div>
      <div class="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/70"></div>
      <div class="relative flex h-full flex-col justify-center px-12">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
          <Footprints :size="24" />
        </span>
        <h2 class="mt-6 text-3xl font-extrabold uppercase leading-tight tracking-tight text-white">
          Vamos recuperar<br />seu acesso
        </h2>
        <p class="mt-3 max-w-sm text-slate-200">
          Envie seu e-mail cadastrado e mandamos um link pra você criar uma nova senha.
        </p>
      </div>
    </div>

    <div class="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
      <div class="mx-auto w-full max-w-sm">
        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Esqueci minha senha</h1>
        <p class="mt-1 text-sm text-slate-500">Informe seu e-mail pra receber o link de recuperação.</p>

        <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ erro }}
        </p>

        <div v-if="enviado" class="mt-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-4 text-sm text-primary">
          Se esse e-mail estiver cadastrado, você vai receber um link de recuperação em instantes. Confira também a caixa de spam.
        </div>

        <form v-else class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">E-mail</label>
            <input
              v-model="email"
              type="email"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
          </div>
          <button
            type="submit"
            :disabled="carregando"
            class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          >
            {{ carregando ? 'Enviando...' : 'Enviar link de recuperação' }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-slate-500">
          Lembrou a senha?
          <NuxtLink to="/login" class="font-semibold text-secondary hover:underline">Entrar</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
