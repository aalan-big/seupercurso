<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { token } = useAuth()
const { organizador, fetchMe } = useOrganizador()
const config = useRuntimeConfig()

const clientBase = config.public.clientBase as string
const verificando = ref(true)

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login')
    return
  }

  try {
    await fetchMe()
  } catch {
    await navigateTo('/onboarding')
    return
  }

  if (organizador.value?.status === 'APROVADO') {
    await navigateTo('/dashboard')
    return
  }

  verificando.value = false
})

const mensagem = computed(() => {
  switch (organizador.value?.status) {
    case 'REJEITADO':
      return 'Sua solicitação de cadastro como organizador foi rejeitada. Entre em contato com o suporte pra mais detalhes.'
    case 'SUSPENSO':
      return 'Seu cadastro de organizador está suspenso no momento. Entre em contato com o suporte pra mais detalhes.'
    default:
      return 'Sua solicitação de cadastro como organizador está em análise. Assim que for aprovada, você já pode criar seus eventos.'
  }
})
</script>

<template>
  <div v-if="!verificando" class="text-center">
    <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning/10 text-2xl">⏳</span>
    <h1 class="mt-4 text-2xl font-extrabold uppercase tracking-tight text-primary">Cadastro em análise</h1>
    <p class="mt-3 text-sm text-slate-500">{{ mensagem }}</p>

    <a
      :href="clientBase"
      class="mt-6 inline-block text-sm font-semibold text-secondary hover:underline"
    >
      ← Voltar para o site principal
    </a>
  </div>
</template>
