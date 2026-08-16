<script setup lang="ts">
const { token } = useAuth()
const { organizador, fetchMe } = useOrganizador()

const verificando = ref(true)
const menuAberto = ref(false)

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

  if (organizador.value?.status !== 'APROVADO') {
    await navigateTo(organizador.value?.documentoIdentidadeUrl ? '/aguardando-aprovacao' : '/onboarding')
    return
  }

  verificando.value = false
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-50">
    <AppSidebar :aberto="menuAberto" @fechar="menuAberto = false" />

    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div class="flex items-center gap-3 md:hidden">
          <button type="button" class="rounded-lg p-1 text-slate-600 hover:bg-slate-100" @click="menuAberto = true">
            ☰
          </button>
          <span class="text-base font-extrabold tracking-tight text-primary">
            Seu<span class="text-warning">Percurso</span>
          </span>
        </div>
        <div class="hidden md:block"></div>
        <AppTopbarMenu />
      </div>

      <main class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
        <slot v-if="!verificando" />
      </main>
    </div>
  </div>
</template>
