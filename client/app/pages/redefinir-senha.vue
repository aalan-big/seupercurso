<script setup lang="ts">
import { Footprints } from 'lucide-vue-next'

const { redefinirSenha } = useAuth()
const route = useRoute()

const token = computed(() => {
  const t = route.query.token
  return typeof t === 'string' ? t : ''
})

const novaSenha = ref('')
const confirmarSenha = ref('')
const erro = ref('')
const sucesso = ref(false)
const carregando = ref(false)

async function onSubmit() {
  erro.value = ''

  if (!token.value) {
    erro.value = 'Link inválido ou expirado. Solicite uma nova recuperação de senha.'
    return
  }
  if (novaSenha.value.length < 8) {
    erro.value = 'A senha precisa ter no mínimo 8 caracteres.'
    return
  }
  if (novaSenha.value !== confirmarSenha.value) {
    erro.value = 'As senhas não coincidem.'
    return
  }

  carregando.value = true
  try {
    await redefinirSenha(token.value, novaSenha.value)
    sucesso.value = true
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
      <div class="absolute inset-0 bg-cover bg-center" :style="{ backgroundImage: `url(/hero-ciclismo.jpg)` }"></div>
      <div class="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/70"></div>
      <div class="relative flex h-full flex-col justify-center px-12">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur">
          <Footprints :size="24" />
        </span>
        <h2 class="mt-6 text-3xl font-extrabold uppercase leading-tight tracking-tight text-white">
          Quase lá!
        </h2>
        <p class="mt-3 max-w-sm text-slate-200">
          Escolha uma nova senha pra voltar a acessar sua conta.
        </p>
      </div>
    </div>

    <div class="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
      <div class="mx-auto w-full max-w-sm">
        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Nova senha</h1>
        <p class="mt-1 text-sm text-slate-500">Defina a nova senha da sua conta.</p>

        <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ erro }}
        </p>

        <div v-if="sucesso" class="mt-6 rounded-xl border border-accent/30 bg-accent/10 px-4 py-4 text-sm text-primary">
          Senha alterada com sucesso!
          <NuxtLink to="/login" class="font-semibold underline">Fazer login</NuxtLink>
        </div>

        <form v-else class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nova senha</label>
            <input
              v-model="novaSenha"
              type="password"
              required
              minlength="8"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
            <p class="mt-1 text-xs text-slate-400">Mínimo de 8 caracteres.</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Confirmar nova senha</label>
            <input
              v-model="confirmarSenha"
              type="password"
              required
              minlength="8"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
          </div>
          <button
            type="submit"
            :disabled="carregando"
            class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          >
            {{ carregando ? 'Salvando...' : 'Redefinir senha' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
