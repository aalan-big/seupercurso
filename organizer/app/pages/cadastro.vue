<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { token, register } = useAuth()

const form = reactive({ email: '', password: '', confirmarSenha: '' })
const erro = ref('')
const carregando = ref(false)

onMounted(() => {
  if (token.value) {
    navigateTo('/dashboard')
  }
})

async function onSubmit() {
  erro.value = ''

  if (form.password.length < 8) {
    erro.value = 'A senha precisa ter no mínimo 8 caracteres.'
    return
  }
  if (form.password !== form.confirmarSenha) {
    erro.value = 'As senhas não coincidem.'
    return
  }

  carregando.value = true
  try {
    await register(form.email, form.password)
    await navigateTo('/onboarding')
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Criar conta</h1>
    <p class="mt-1 text-sm text-slate-500">Cadastre-se pra começar a organizar seus eventos.</p>

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
          minlength="8"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <p class="mt-1 text-xs text-slate-400">Mínimo de 8 caracteres.</p>
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Confirmar senha</label>
        <input
          v-model="form.confirmarSenha"
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
        {{ carregando ? 'Criando conta...' : 'Continuar' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-slate-500">
      Já tem conta?
      <NuxtLink to="/login" class="font-semibold text-secondary hover:underline">Entrar</NuxtLink>
    </p>
  </div>
</template>
