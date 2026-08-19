<script setup lang="ts">
import type { EventoResumo } from '../composables/useEvento'

const props = defineProps<{ evento: EventoResumo }>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

const bannerUrlFormatada = computed(() => {
  if (!props.evento.bannerUrl) return null
  if (props.evento.bannerUrl.startsWith('http')) return props.evento.bannerUrl
  return `${apiBase.replace(/\/$/, '')}/${props.evento.bannerUrl.replace(/^\//, '')}`
})

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
    class="group block overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:border-slate-300"
  >
    <div class="relative overflow-hidden h-52 bg-slate-900">
      <img
        v-if="bannerUrlFormatada"
        :src="bannerUrlFormatada"
        :alt="props.evento.nome"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <div
        v-else
        :class="['flex h-52 items-center justify-center bg-gradient-to-br text-6xl', gradientePorId(props.evento.id)]"
      >
        🏃
      </div>
      <span
        class="absolute left-4 top-4 rounded-full bg-white/95 backdrop-blur-xs px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wider text-primary shadow-md"
      >
        📅 {{ formatarData(props.evento.dataInicio) }}
      </span>
    </div>
    <div class="p-6">
      <h3 class="text-lg font-extrabold uppercase tracking-tight text-slate-900 group-hover:text-secondary transition line-clamp-1">
        {{ props.evento.nome }}
      </h3>
      <p class="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-500">
        📍 {{ props.evento.cidade }}/{{ props.evento.estado }}
      </p>

      <div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <div>
          <span class="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Inscrições</span>
          <p class="text-base font-extrabold text-accent">
            <template v-if="formatarPreco(props.evento.valorApartirDe)">
              A partir de {{ formatarPreco(props.evento.valorApartirDe) }}
            </template>
            <template v-else>Em breve</template>
          </p>
        </div>
        <span class="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide text-primary transition group-hover:bg-primary group-hover:text-white">
          Garantir Vaga →
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
