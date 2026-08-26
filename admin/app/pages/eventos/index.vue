<script setup lang="ts">
import { Ban } from 'lucide-vue-next'

const { eventos, fetchLista } = useAdminEventos()

const filtro = ref<'AGUARDANDO_APROVACAO' | 'PUBLICADO' | 'RASCUNHO' | 'SUSPENSO' | ''>('AGUARDANDO_APROVACAO')
const carregando = ref(true)
const erro = ref('')

const abas = [
  { valor: 'AGUARDANDO_APROVACAO' as const, label: 'Aguardando revisão' },
  { valor: 'PUBLICADO' as const, label: 'Publicados' },
  { valor: 'SUSPENSO' as const, label: 'Barrados / Suspensos' },
  { valor: 'RASCUNHO' as const, label: 'Rascunho' },
  { valor: '' as const, label: 'Todos' }
]

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    await fetchLista(filtro.value || undefined)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

watch(filtro, carregar)
onMounted(carregar)

function nomeOrganizador(evento: (typeof eventos.value)[number]) {
  const cliente = evento.organizador.cliente
  return cliente.pf?.nomeCompleto || cliente.pj?.razaoSocial || cliente.usuario.email
}

const statusClasse: Record<string, string> = {
  RASCUNHO: 'bg-slate-200 text-slate-600',
  AGUARDANDO_APROVACAO: 'bg-warning/10 text-warning',
  PUBLICADO: 'bg-accent/10 text-accent',
  INSCRICOES_ENCERRADAS: 'bg-slate-200 text-slate-600',
  CANCELADO: 'bg-red-100 text-red-700',
  FINALIZADO: 'bg-slate-200 text-slate-600',
  SUSPENSO: 'bg-red-500 text-white font-black'
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Eventos</h1>
    <p class="mt-1 text-sm text-slate-500">Revise antes de publicar — é o que aparece pro público depois.</p>

    <div class="mt-6 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="aba in abas"
        :key="aba.valor"
        type="button"
        class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold uppercase tracking-wide transition"
        :class="filtro === aba.valor ? 'border-primary bg-primary text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'"
        @click="filtro = aba.valor"
      >
        <Ban v-if="aba.valor === 'SUSPENSO'" :size="14" />
        {{ aba.label }}
      </button>
    </div>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <div v-else-if="eventos.length === 0" class="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      Nenhum evento nessa situação.
    </div>

    <div v-else class="mt-6 flex flex-col gap-3">
      <NuxtLink
        v-for="evento in eventos"
        :key="evento.id"
        :to="`/eventos/${evento.id}`"
        class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-secondary"
      >
        <div class="min-w-0">
          <p class="truncate font-bold text-slate-800">{{ evento.nome }}</p>
          <p class="mt-0.5 truncate text-xs text-slate-400">
            {{ nomeOrganizador(evento) }} · {{ evento.cidade }}/{{ evento.estado }} · {{ formatarData(evento.dataInicio) }}
          </p>
        </div>
        <span
          class="shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          :class="statusClasse[evento.status]"
        >
          {{ evento.status }}
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
