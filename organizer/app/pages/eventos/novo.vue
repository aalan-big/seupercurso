<script setup lang="ts">
const { criarEvento, uploadMidia } = useEventoOrganizador()

const carregando = ref(false)
const erro = ref('')

async function onSubmit(payload: Record<string, unknown>, arquivoRegulamento: File | null) {
  erro.value = ''
  carregando.value = true
  try {
    const evento = await criarEvento(payload as Parameters<typeof criarEvento>[0])
    if (arquivoRegulamento) {
      try {
        await uploadMidia(evento.id, 'regulamento', arquivoRegulamento)
      } catch {
        // evento já foi criado; organizador pode reenviar o PDF na tela de edição
      }
    }
    await navigateTo(`/eventos/${evento.id}/editar`)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Criar evento</h1>
    <p class="mt-1 text-sm text-slate-500">
      Preencha os dados básicos do seu evento. Você pode editar tudo depois.
      <span class="text-slate-400">Campos com * são obrigatórios.</span>
    </p>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <div class="mt-6">
      <EventoForm :carregando="carregando" @submit="onSubmit" />
    </div>
  </div>
</template>
