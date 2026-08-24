<script setup lang="ts">
definePageMeta({ layout: 'staff' })

const { token, login } = useStaffAuth()

const form = reactive({ email: '', password: '' })
const mostrarSenha = ref(false)
const erro = ref('')
const carregando = ref(false)

onMounted(() => {
  if (token.value) {
    navigateTo('/staff/checkin')
  }
})

async function onSubmit() {
  erro.value = ''
  carregando.value = true
  try {
    await login(form.email, form.password)
    await navigateTo('/staff/checkin')
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm pt-10">
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Acesso da equipe</h1>
    <p class="mt-1 text-sm text-slate-500">Entre com o login que o organizador te passou.</p>

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
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Senha</label>
        <div class="relative">
          <input
            v-model="form.password"
            :type="mostrarSenha ? 'text' : 'password'"
            required
            class="w-full rounded-xl border border-slate-300 pl-4 pr-11 py-3 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
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
        class="mt-2 rounded-xl bg-warning px-4 py-4 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
      >
        {{ carregando ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>
