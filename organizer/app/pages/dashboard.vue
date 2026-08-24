<script setup lang="ts">
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { DashboardOrganizador } from '../composables/useDashboardOrganizador'

ChartJS.register(ArcElement, Tooltip, Legend)

const { buscar } = useDashboardOrganizador()

const dashboard = ref<DashboardOrganizador | null>(null)
const carregando = ref(true)
const erro = ref('')

onMounted(async () => {
  erro.value = ''
  carregando.value = true
  try {
    dashboard.value = await buscar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

const cards = computed(() => {
  if (!dashboard.value) return []
  const c = dashboard.value.contadores
  return [
    { label: 'Meus eventos', valor: c.totalEventos, cor: 'text-slate-900', icone: 'eventos' },
    { label: 'Publicados', valor: c.eventosPublicados, cor: 'text-emerald-600', icone: 'check' },
    { label: 'Aguardando revisão', valor: c.eventosAguardandoAprovacao, cor: 'text-amber-500', icone: 'warning' },
    { label: 'Inscrições confirmadas', valor: c.inscricoesConfirmadas, cor: 'text-blue-600', icone: 'inscritos' },
    { label: 'Kits pendentes de entrega', valor: c.kitsPendentes, cor: 'text-amber-500', icone: 'kits' }
  ]
})


function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const chartOpcoes = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 16, font: { size: 12 } } }
  }
}

const eventoLabels: Record<string, { texto: string; cor: string }> = {
  RASCUNHO: { texto: 'Rascunho', cor: '#94A3B8' },
  AGUARDANDO_APROVACAO: { texto: 'Aguardando revisão', cor: '#F59E0B' },
  PUBLICADO: { texto: 'Publicado', cor: '#10B981' },
  INSCRICOES_ENCERRADAS: { texto: 'Inscrições encerradas', cor: '#2563EB' },
  CANCELADO: { texto: 'Cancelado', cor: '#EF4444' },
  FINALIZADO: { texto: 'Finalizado', cor: '#0F172A' }
}

const dadosEventos = computed(() => {
  if (!dashboard.value) return null
  const entradas = Object.entries(dashboard.value.eventosPorStatus).filter(([, valor]) => valor > 0)
  return {
    labels: entradas.map(([status]) => eventoLabels[status]?.texto || status),
    datasets: [
      {
        data: entradas.map(([, valor]) => valor),
        backgroundColor: entradas.map(([status]) => eventoLabels[status]?.cor || '#94A3B8'),
        borderWidth: 0
      }
    ]
  }
})

const dadosKits = computed(() => {
  if (!dashboard.value) return null
  const { inscricoesConfirmadas, kitsPendentes } = dashboard.value.contadores
  const entregues = inscricoesConfirmadas - kitsPendentes
  if (inscricoesConfirmadas === 0) return null
  return {
    labels: ['Entregues', 'Pendentes'],
    datasets: [
      {
        data: [entregues, kitsPendentes],
        backgroundColor: ['#10B981', '#F59E0B'],
        borderWidth: 0
      }
    ]
  }
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Dashboard</h1>
    <p class="mt-1 text-sm text-slate-500">Visão geral dos seus eventos.</p>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="dashboard">
      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div v-for="card in cards" :key="card.label" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-3xl font-black tracking-tight" :class="card.cor">{{ card.valor }}</p>
            <div class="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <AppIcon :name="card.icone" size="18" />
            </div>
          </div>
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
        </div>
      </div>


      <div class="mt-8">
        <TendenciaChart titulo="Inscrições confirmadas — últimos 14 dias" :serie="dashboard.inscricoesPorDia" />
      </div>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Meus eventos por status</h2>
          <div class="mx-auto mt-4 h-64 max-w-xs">
            <Doughnut v-if="dadosEventos && dadosEventos.labels.length > 0" :data="dadosEventos" :options="chartOpcoes" />
            <p v-else class="pt-16 text-center text-sm text-slate-400">Nenhum evento cadastrado ainda.</p>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Entrega de kits</h2>
          <div class="mx-auto mt-4 h-64 max-w-xs">
            <Doughnut v-if="dadosKits" :data="dadosKits" :options="chartOpcoes" />
            <p v-else class="pt-16 text-center text-sm text-slate-400">Nenhuma inscrição confirmada ainda.</p>
          </div>
        </div>
      </div>

      <div class="mt-8">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Próximos eventos</h2>
        <div v-if="dashboard.proximosEventos.length === 0" class="mt-3 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          Nenhum evento publicado com data futura.
        </div>
        <div v-else class="mt-3 flex flex-col gap-2">
          <NuxtLink
            v-for="evento in dashboard.proximosEventos"
            :key="evento.id"
            :to="`/eventos/${evento.id}/editar`"
            class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-secondary"
          >
            <p class="font-semibold text-slate-700">{{ evento.nome }}</p>
            <p class="mt-0.5 text-xs text-slate-400">{{ formatarData(evento.dataInicio) }} · {{ evento.cidade }}/{{ evento.estado }}</p>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>
