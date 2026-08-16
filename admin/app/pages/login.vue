<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { token, login } = useAuth()

const form = reactive({ email: '', password: '' })
const erro = ref('')
const carregando = ref(false)

onMounted(() => {
  if (token.value) {
    navigateTo('/organizadores')
  }
})

async function onSubmit() {
  erro.value = ''
  carregando.value = true
  try {
    await login(form.email, form.password)
    await navigateTo('/organizadores')
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Entrar</h1>
    <p class="mt-1 text-sm text-slate-500">Acesso restrito à equipe SeuPercurso.</p>

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
        {{ carregando ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>
