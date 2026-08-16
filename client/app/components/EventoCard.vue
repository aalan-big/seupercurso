<script setup lang="ts">
import type { EventoResumo } from '../composables/useEvento'

const props = defineProps<{ evento: EventoResumo }>()

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatarPreco(valor: number | null) {
  return valor === null ? null : `R$ ${valor.toFixed(2)}`
}
</script>

<template>
  <NuxtLink
    :to="`/eventos/${props.evento.id}`"
    class="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
  >
    <div class="relative">
      <div
        :class="['flex h-36 items-center justify-center bg-gradient-to-br text-5xl', gradientePorId(props.evento.id)]"
      >
        🏃
      </div>
      <span
        class="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary shadow"
      >
        {{ formatarData(props.evento.dataInicio) }}
      </span>
    </div>
    <div class="p-4">
      <h3 class="font-bold text-slate-800 group-hover:text-secondary">{{ props.evento.nome }}</h3>
      <p class="mt-1 flex items-center gap-1 text-sm text-slate-500">📍 {{ props.evento.cidade }}/{{ props.evento.estado }}</p>
      <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <p class="text-sm font-semibold text-accent">
          <template v-if="formatarPreco(props.evento.valorApartirDe)">
            A partir de {{ formatarPreco(props.evento.valorApartirDe) }}
          </template>
          <template v-else>Em breve</template>
        </p>
        <span class="text-xs font-bold uppercase tracking-wide text-secondary">Inscrever-se →</span>
      </div>
    </div>
  </NuxtLink>
</template>
