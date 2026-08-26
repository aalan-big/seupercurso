<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

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
      <div class="flex justify-center text-slate-500">
        <Loader2 :size="32" class="animate-spin" />
      </div>
      <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Redirecionando para o evento...</p>
    </div>
  </div>
</template>
