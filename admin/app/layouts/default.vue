<script setup lang="ts">
const { token, user, fetchMe } = useAuth()

const verificando = ref(true)
const menuAberto = ref(false)

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login')
    return
  }

  try {
    if (!user.value) await fetchMe()
  } catch {
    await navigateTo('/login')
    return
  }

  verificando.value = false
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-50">
    <AppSidebar :aberto="menuAberto" @fechar="menuAberto = false" />

    <div class="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <!-- Menu Superior Header Master -->
      <AppHeader @abrir-menu="menuAberto = true" />

      <main class="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8">
        <slot v-if="!verificando" />
      </main>
    </div>
  </div>
</template>
