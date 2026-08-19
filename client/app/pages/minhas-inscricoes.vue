<script setup lang="ts">
onMounted(async () => {
  await navigateTo('/meus-eventos', { replace: true })
})
</script>

<template>
  <div class="py-12 text-center text-sm text-slate-500">
    Redirecionando para Meus Eventos...
  </div>
</template>
