<script setup lang="ts">
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'vue-chartjs'
import type { DashboardAdmin } from '../composables/useAdminDashboard'

ChartJS.register(ArcElement, Tooltip, Legend)

const { buscar } = useAdminDashboard()

const dashboard = ref<DashboardAdmin | null>(null)
const carregando = ref(true)
const erro = ref('')

const statusPermissao = ref('default')
const ativandoNotif = ref(false)
const msgNotif = ref('')

onMounted(async () => {
  erro.value = ''
  carregando.value = true

  if (typeof window !== 'undefined' && 'Notification' in window) {
    statusPermissao.value = Notification.permission
  }

  try {
    dashboard.value = await buscar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

async function onAtivarNotificacaoAparelho() {
  ativandoNotif.value = true
  msgNotif.value = 'Solicitando autorização do aparelho...'
  const { $notificacoes } = useNuxtApp() as any
  if ($notificacoes) {
    await $notificacoes.solicitarPermissao()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      statusPermissao.value = Notification.permission
    }
    if (statusPermissao.value === 'granted') {
      msgNotif.value = 'Notificação ativada com sucesso! Enviando notificação de teste...'
      await $notificacoes.testarNotificacaoBackend(15.00)
      msgNotif.value = 'Pronto! Notificação enviada para a tela de bloqueio deste aparelho. Bloqueie para ver!'
    } else {
      msgNotif.value = 'Aviso: Permissão não concedida. Toque em Permitir no popup do seu aparelho.'
    }
  }
  ativandoNotif.value = false
}

async function onTestarNotificacao() {
  ativandoNotif.value = true
  msgNotif.value = 'Enviando notificação de teste...'
  const { $notificacoes } = useNuxtApp() as any
  if ($notificacoes) {
    await $notificacoes.testarNotificacaoBackend(15.00)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      statusPermissao.value = Notification.permission
    }
    msgNotif.value = 'Notificação disparada com sucesso! Bloqueie a tela do celular para ver o aviso.'
  }
  ativandoNotif.value = false
}

function nomeOrganizador(org: DashboardAdmin['organizadoresRecentes'][number]) {
  return org.cliente.pf?.nomeCompleto || org.cliente.pj?.razaoSocial || org.cliente.usuario.email
}

function nomeOrganizadorDoEvento(evento: DashboardAdmin['eventosRecentes'][number]) {
  const cliente = evento.organizador.cliente
  return cliente.pf?.nomeCompleto || cliente.pj?.razaoSocial || cliente.usuario.email
}

const cards = computed(() => {
  if (!dashboard.value) return []
  const c = dashboard.value.contadores
  return [
    { label: 'Organizadores pendentes', valor: c.organizadoresPendentes, cor: 'text-warning' },
    { label: 'Eventos aguardando revisão', valor: c.eventosAguardandoAprovacao, cor: 'text-warning' },
    { label: 'Organizadores aprovados', valor: c.organizadoresAprovados, cor: 'text-accent' },
    { label: 'Eventos publicados', valor: c.eventosPublicados, cor: 'text-accent' },
    { label: 'Inscrições confirmadas', valor: c.inscricoesConfirmadas, cor: 'text-secondary' }
  ]
})

const chartOpcoes = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 16, font: { size: 12 } } }
  }
}

const organizadorLabels: Record<string, { texto: string; cor: string }> = {
  PENDENTE: { texto: 'Pendente', cor: '#F59E0B' },
  APROVADO: { texto: 'Aprovado', cor: '#10B981' },
  REJEITADO: { texto: 'Rejeitado', cor: '#EF4444' },
  SUSPENSO: { texto: 'Suspenso', cor: '#94A3B8' }
}

const eventoLabels: Record<string, { texto: string; cor: string }> = {
  RASCUNHO: { texto: 'Rascunho', cor: '#94A3B8' },
  AGUARDANDO_APROVACAO: { texto: 'Aguardando revisão', cor: '#F59E0B' },
  PUBLICADO: { texto: 'Publicado', cor: '#10B981' },
  INSCRICOES_ENCERRADAS: { texto: 'Inscrições encerradas', cor: '#2563EB' },
  CANCELADO: { texto: 'Cancelado', cor: '#EF4444' },
  FINALIZADO: { texto: 'Finalizado', cor: '#0F172A' }
}

function montarDados(porStatus: Record<string, number>, labels: Record<string, { texto: string; cor: string }>) {
  const entradas = Object.entries(porStatus).filter(([, valor]) => valor > 0)
  return {
    labels: entradas.map(([status]) => labels[status]?.texto || status),
    datasets: [
      {
        data: entradas.map(([, valor]) => valor),
        backgroundColor: entradas.map(([status]) => labels[status]?.cor || '#94A3B8'),
        borderWidth: 0
      }
    ]
  }
}

const dadosOrganizadores = computed(() =>
  dashboard.value ? montarDados(dashboard.value.organizadoresPorStatus, organizadorLabels) : null
)
const dadosEventos = computed(() =>
  dashboard.value ? montarDados(dashboard.value.eventosPorStatus, eventoLabels) : null
)
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Dashboard</h1>
    <p class="mt-1 text-sm text-slate-500">Visão geral da plataforma.</p>

    <!-- Card Notificações Nesse Aparelho -->
    <div class="mt-4 rounded-3xl border-2 border-orange-400/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 text-white shadow-xl">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/30">
            <AppIcon name="bell" size="24" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-black uppercase tracking-tight text-white">Notificações de Comissão</h3>
              <span
                v-if="statusPermissao === 'granted'"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-500/30"
              >
                ✅ ATIVADAS NESSE APARELHO
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30"
              >
                ⚠️ PENDENTE DE ATIVAÇÃO
              </span>
            </div>
            <p class="text-xs text-slate-300 mt-0.5">
              Receba avisos instantâneos com som de caixa e vibração na tela de bloqueio deste aparelho.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <button
            v-if="statusPermissao !== 'granted'"
            type="button"
            :disabled="ativandoNotif"
            class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:brightness-110 active:scale-95 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-orange-500/25 transition disabled:opacity-50 cursor-pointer"
            @click="onAtivarNotificacaoAparelho"
          >
            <AppIcon name="bell" size="16" /> {{ ativandoNotif ? 'Ativando...' : 'Ativar Notificação nesse Aparelho' }}
          </button>

          <button
            v-else
            type="button"
            :disabled="ativandoNotif"
            class="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 cursor-pointer"
            @click="onTestarNotificacao"
          >
            <AppIcon name="zap" size="16" /> {{ ativandoNotif ? 'Enviando...' : 'Testar Notificação de Comissão' }}
          </button>

          <NuxtLink
            to="/financeiro"
            class="inline-flex items-center gap-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-200 border border-slate-700 transition"
          >
            Ver Financeiro →
          </NuxtLink>
        </div>
      </div>

      <div v-if="msgNotif" class="mt-3.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3.5 py-2.5 text-xs font-semibold text-orange-200 flex items-center gap-2">
        <span>🔔</span> {{ msgNotif }}
      </div>
    </div>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="dashboard">
      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div v-for="card in cards" :key="card.label" class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-3xl font-extrabold" :class="card.cor">{{ card.valor }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
        </div>
      </div>

      <div class="mt-8">
        <TendenciaChart titulo="Inscrições confirmadas — últimos 14 dias" :serie="dashboard.inscricoesPorDia" />
      </div>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Organizadores por status</h2>
          <div class="mx-auto mt-4 h-64 max-w-xs">
            <Doughnut v-if="dadosOrganizadores && dadosOrganizadores.labels.length > 0" :data="dadosOrganizadores" :options="chartOpcoes" />
            <p v-else class="pt-16 text-center text-sm text-slate-400">Sem dados ainda.</p>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Eventos por status</h2>
          <div class="mx-auto mt-4 h-64 max-w-xs">
            <Doughnut v-if="dadosEventos && dadosEventos.labels.length > 0" :data="dadosEventos" :options="chartOpcoes" />
            <p v-else class="pt-16 text-center text-sm text-slate-400">Sem dados ainda.</p>
          </div>
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Organizadores pendentes</h2>
          <div v-if="dashboard.organizadoresRecentes.length === 0" class="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nenhum organizador pendente.
          </div>
          <div v-else class="mt-3 flex flex-col gap-2">
            <NuxtLink
              v-for="org in dashboard.organizadoresRecentes"
              :key="org.id"
              :to="`/organizadores/${org.id}`"
              class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-secondary"
            >
              {{ nomeOrganizador(org) }}
            </NuxtLink>
          </div>
          <NuxtLink to="/organizadores" class="mt-3 inline-block text-sm font-semibold text-secondary hover:underline">
            Ver todos →
          </NuxtLink>
        </div>

        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Eventos aguardando revisão</h2>
          <div v-if="dashboard.eventosRecentes.length === 0" class="mt-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Nenhum evento aguardando revisão.
          </div>
          <div v-else class="mt-3 flex flex-col gap-2">
            <NuxtLink
              v-for="evento in dashboard.eventosRecentes"
              :key="evento.id"
              :to="`/eventos/${evento.id}`"
              class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-secondary"
            >
              <p class="font-semibold text-slate-700">{{ evento.nome }}</p>
              <p class="mt-0.5 text-xs text-slate-400">{{ nomeOrganizadorDoEvento(evento) }}</p>
            </NuxtLink>
          </div>
          <NuxtLink to="/eventos" class="mt-3 inline-block text-sm font-semibold text-secondary hover:underline">
            Ver todos →
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
</template>
