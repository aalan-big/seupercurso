<script setup lang="ts">
const { eventos, fetchMeusEventos } = useEventoOrganizador()

const carregando = ref(true)
const erro = ref('')

onMounted(async () => {
  try {
    await fetchMeusEventos()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const statusInfo: Record<string, { texto: string; classe: string }> = {
  RASCUNHO: { texto: 'Rascunho', classe: 'bg-slate-100 text-slate-500' },
  PUBLICADO: { texto: 'Aberto', classe: 'bg-accent/10 text-accent' },
  INSCRICOES_ENCERRADAS: { texto: 'Inscrições encerradas', classe: 'bg-warning/10 text-warning' },
  CANCELADO: { texto: 'Cancelado', classe: 'bg-red-50 text-red-600' },
  FINALIZADO: { texto: 'Finalizado', classe: 'bg-secondary/10 text-secondary' }
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Meus eventos</h1>
        <p class="mt-1 text-sm text-slate-500">Gerencie os eventos que você organiza.</p>
      </div>
      <NuxtLink
        to="/eventos/novo"
        class="whitespace-nowrap rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95"
      >
        Criar evento
      </NuxtLink>
    </div>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <p v-else-if="erro" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <div v-else-if="eventos.length === 0" class="mt-10 text-center">
      <div class="text-4xl">🏁</div>
      <p class="mt-3 text-slate-500">Você ainda não criou nenhum evento.</p>
      <NuxtLink
        to="/eventos/novo"
        class="mt-6 inline-block rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95"
      >
        Criar meu primeiro evento
      </NuxtLink>
    </div>

    <div v-else class="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="evento in eventos"
        :key="evento.id"
        :to="`/eventos/${evento.id}/editar`"
        class="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
      >
        <div :class="['flex h-24 items-center justify-center bg-gradient-to-br text-4xl', gradientePorId(evento.id)]">
          🏃
        </div>
        <div class="p-4">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-bold text-slate-800 group-hover:text-secondary">{{ evento.nome }}</h3>
            <span
              class="whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
              :class="statusInfo[evento.status]?.classe || 'bg-slate-100 text-slate-500'"
            >
              {{ statusInfo[evento.status]?.texto || evento.status }}
            </span>
          </div>
          <p class="mt-1 text-sm text-slate-500">📍 {{ evento.cidade }}/{{ evento.estado }}</p>
          <p class="mt-1 text-xs text-slate-400">{{ formatarData(evento.dataInicio) }} — {{ formatarData(evento.dataFim) }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
