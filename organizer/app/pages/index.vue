<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { token } = useAuth()
const { organizador, fetchMe } = useOrganizador()

const verificando = ref(true)

onMounted(async () => {
  if (!token.value) {
    verificando.value = false
    return
  }

  try {
    await fetchMe()
    await navigateTo(organizador.value?.status === 'APROVADO' ? '/dashboard' : '/aguardando-aprovacao')
    return
  } catch {
    token.value = null
    verificando.value = false
    return
  }
})
</script>

<template>
  <div v-if="!verificando" class="text-center">
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Área do organizador</h1>
    <p class="mt-2 text-sm text-slate-500">
      Entre na sua conta ou solicite seu cadastro pra começar a publicar eventos no SeuPercurso.
    </p>

    <div class="mt-6 flex flex-col gap-3">
      <NuxtLink
        to="/login"
        class="rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95"
      >
        Entrar
      </NuxtLink>
      <NuxtLink
        to="/cadastro"
        class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
      >
        Quero ser organizador
      </NuxtLink>
    </div>
  </div>
</template>
