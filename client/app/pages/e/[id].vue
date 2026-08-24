<script setup lang="ts">
const route = useRoute()
const { buscarPorId } = useEvento()

const eventIdOrCode = route.params.id as string

onMounted(async () => {
  try {
    const evento = await buscarPorId(eventIdOrCode)
    if (evento && evento.id) {
      await navigateTo(`/eventos/${evento.id}`, { replace: true })
    } else {
      await navigateTo('/', { replace: true })
    }
  } catch (e) {
    await navigateTo('/', { replace: true })
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50">
    <div class="text-center space-y-3">
      <div class="animate-spin text-3xl">🏃</div>
      <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Redirecionando para o evento...</p>
    </div>
  </div>
</template>
