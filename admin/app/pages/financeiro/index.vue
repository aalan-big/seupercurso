<script setup lang="ts">
import { Crown, BarChart2, Landmark, Zap, AlertTriangle, Gem, Trophy, RefreshCw, Ticket } from 'lucide-vue-next'
import type { FinanceiroAdmin } from '../../composables/useAdminFinanceiro'

const { buscar } = useAdminFinanceiro()

const financeiro = ref<FinanceiroAdmin | null>(null)
const carregando = ref(true)
const erro = ref('')

const statusPermissao = ref('default')
const testando = ref(false)
const feedbackMensagem = ref('')

onMounted(async () => {
  erro.value = ''
  carregando.value = true

  if (typeof window !== 'undefined' && 'Notification' in window) {
    statusPermissao.value = Notification.permission
  }

  try {
    financeiro.value = await buscar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function exportarRelatorioGlobalCSV() {
  if (!financeiro.value || financeiro.value.porOrganizador.length === 0) return

  let csvContent = 'data:text/csv;charset=utf-8,'
  csvContent += 'Organizador,Evento,Inscrições Pagas,Total Arrecadado (R$),Comissão Plataforma (R$),Repasse Subconta (R$)\n'

  financeiro.value.porOrganizador.forEach((org) => {
    org.eventos.forEach((ev) => {
      csvContent += `"${org.nome.replace(/"/g, '""')}","${ev.nome.replace(/"/g, '""')}",${ev.quantidadePagamentos},${ev.totalArrecadado.toFixed(2)},${ev.comissaoPlataforma.toFixed(2)},${ev.repasse.toFixed(2)}\n`
    })
  })

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `Relatorio_Financeiro_Global_SeuPercurso_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function ativarENotificar() {
  testando.value = true
  feedbackMensagem.value = 'Solicitando autorização do iPhone/Android...'
  const { $notificacoes } = useNuxtApp() as any
  if ($notificacoes) {
    await $notificacoes.solicitarPermissao()
    if (typeof window !== 'undefined' && 'Notification' in window) {
      statusPermissao.value = Notification.permission
    }
    if (statusPermissao.value === 'granted') {
      feedbackMensagem.value = 'Notificações ativadas com sucesso! Disparando teste...'
      await $notificacoes.testarNotificacaoBackend(15.00)
      feedbackMensagem.value = 'Pronto! Notificação enviada para a tela de bloqueio da Apple. Bloqueie o celular para ver!'
    } else {
      feedbackMensagem.value = 'Aviso: Permissão não concedida. Certifique-se de tocar em Permitir.'
    }
  }
  testando.value = false
}

async function testarPushBloqueio() {
  testando.value = true
  feedbackMensagem.value = 'Enviando notificação Apple Push...'
  const { $notificacoes } = useNuxtApp() as any
  if ($notificacoes) {
    await $notificacoes.testarNotificacaoBackend(15.00)
    if (typeof window !== 'undefined' && 'Notification' in window) {
      statusPermissao.value = Notification.permission
    }
    feedbackMensagem.value = 'Notificação enviada! Bloqueie a tela do celular para ver o banner nativo com som.'
  }
  testando.value = false
}
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho Principal do Admin Financeiro -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-black uppercase tracking-tight text-primary">Gestão Financeira & Conta Master CNPJ</h1>
          <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
            <Crown :size="14" /> Conta Master Asaas Conectada
          </span>
        </div>
        <p class="mt-1 text-xs text-slate-500">
          Visão consolidada de todas as transações, comissão retida e movimentações de subcontas dos organizadores.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          :disabled="!financeiro || financeiro.porOrganizador.length === 0"
          class="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition disabled:opacity-40"
          @click="exportarRelatorioGlobalCSV"
        >
          <BarChart2 :size="16" /> Exportar Relatório Global (CSV)
        </button>
      </div>
    </div>

    <!-- Card de Controle de Notificações na Tela de Bloqueio (Apple Push / Android / PC) -->
    <div class="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-white p-5 shadow-xs">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
            <Zap :size="22" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-sm text-slate-900 uppercase tracking-tight">Notificações na Tela de Bloqueio (iPhone / Android)</h3>
              <span
                v-if="statusPermissao === 'granted'"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-200"
              >
                ✅ ATIVAS
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200"
              >
                ⚠️ PENDENTE DE ATIVAÇÃO
              </span>
            </div>
            <p class="text-xs text-slate-600 mt-0.5">
              Receba avisos instantâneos com som de dinheiro mesmo com o celular no bolso ou tela desligada.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            v-if="statusPermissao !== 'granted'"
            type="button"
            :disabled="testando"
            class="inline-flex items-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-orange-600/25 transition disabled:opacity-50"
            @click="ativarENotificar"
          >
            <Zap :size="16" /> {{ testando ? 'Ativando...' : 'Ativar Notificação nesse Aparelho' }}
          </button>

          <button
            type="button"
            :disabled="testando"
            class="inline-flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-black active:scale-[0.98] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition disabled:opacity-50"
            @click="testarPushBloqueio"
          >
            <RefreshCw :size="15" :class="{ 'animate-spin': testando }" />
            {{ testando ? 'Enviando...' : 'Testar na Tela de Bloqueio' }}
          </button>
        </div>
      </div>

      <div v-if="feedbackMensagem" class="mt-3.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-900 flex items-center gap-2">
        <span>🔔</span> {{ feedbackMensagem }}
      </div>
    </div>

    <!-- Card da Conta Master CNPJ Principal -->
    <div class="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-4 shadow-xs">
      <div class="flex min-w-0 items-center gap-3">
        <Landmark :size="28" class="shrink-0 text-blue-700" />
        <div class="min-w-0">
          <p class="font-bold text-sm text-blue-950">Conta Master CNPJ — SeuPercurso Plataforma</p>
          <p class="text-[11px] text-blue-800 mt-0.5">
            Sua conta principal gerencia a chave de API Master. Todas as comissões de intermediação (ex: 10%) caem automaticamente no seu saldo Master via Split Asaas.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2 bg-white/90 px-3.5 py-2 rounded-xl border border-blue-200 text-blue-900 font-bold">
        <span class="inline-flex items-center gap-1"><Zap :size="14" class="text-amber-500" /> Asaas Split Engine Active</span>
      </div>
    </div>

    <p v-if="erro" class="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
      <AlertTriangle :size="14" class="text-amber-500" /> {{ erro }}
    </p>

    <div v-if="carregando" class="py-12 text-center text-xs text-slate-400">
      Carregando consolidado financeiro da plataforma...
    </div>

    <template v-else-if="financeiro">
      <!-- 3 Cards KPI Master com Cores e Gradientes Executivos -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <!-- Card 1: Volume Bruto Transacionado -->
        <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Volume Bruto Global</span>
            <span class="rounded-lg bg-blue-50 p-2 text-blue-600"><Gem :size="16" /></span>
          </div>
          <p class="mt-3 text-2xl font-black text-slate-900">{{ formatarValor(financeiro.totalArrecadado) }}</p>
          <p class="mt-1 text-[11px] text-slate-500">Total transacionado em toda a plataforma</p>
        </div>

        <!-- Card 2: Lucro Líquido da Plataforma (Sua Comissão) -->
        <div class="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-sm transition hover:shadow-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-100">Comissão Retida (Conta Master CNPJ)</span>
            <span class="rounded-lg bg-white/20 p-2 text-white"><Trophy :size="16" /></span>
          </div>
          <p class="mt-3 text-2xl font-black text-white">{{ formatarValor(financeiro.comissaoPlataforma) }}</p>
          <p class="mt-1 text-[11px] text-emerald-100">Lucro líquido creditado no seu CNPJ</p>
        </div>

        <!-- Card 3: Total Repassado para Subcontas -->
        <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Repasses para Subcontas</span>
            <span class="rounded-lg bg-indigo-50 p-2 text-indigo-600"><RefreshCw :size="16" /></span>
          </div>
          <p class="mt-3 text-2xl font-black text-slate-700">{{ formatarValor(financeiro.totalRepasse) }}</p>
          <p class="mt-1 text-[11px] text-slate-500">Valor transferido direto para organizadores</p>
        </div>
      </div>

      <!-- Detalhamento por Organizador -->
      <div class="space-y-4 pt-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-700">Consolidado por Organizador e Subconta</h2>
          <span class="text-xs text-slate-400">{{ financeiro.porOrganizador.length }} organizador(es) ativo(s)</span>
        </div>

        <div v-if="financeiro.porOrganizador.length === 0" class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-xs text-slate-500">
          Nenhum pagamento registrado na plataforma ainda.
        </div>

        <div v-else class="flex flex-col gap-4">
          <div
            v-for="org in financeiro.porOrganizador"
            :key="org.organizadorId"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
          >
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4">
              <div class="min-w-0">
                <p class="truncate font-black text-sm text-slate-900">{{ org.nome }}</p>
                <p class="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <Ticket :size="14" class="shrink-0" /> {{ org.quantidadePagamentos }} inscrição(ões) paga(s) · {{ org.eventos.length }} evento(s)
                </p>
              </div>

              <div class="flex items-center gap-6 text-right text-xs">
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Bruto</p>
                  <p class="font-bold text-slate-800">{{ formatarValor(org.totalArrecadado) }}</p>
                </div>
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sua Comissão</p>
                  <p class="font-black text-emerald-600">{{ formatarValor(org.comissaoPlataforma) }}</p>
                </div>
                <div>
                  <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repasse Organizador</p>
                  <p class="font-bold text-slate-700">{{ formatarValor(org.repasse) }}</p>
                </div>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-100/50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th class="px-5 py-2.5">Nome do Evento</th>
                    <th class="px-5 py-2.5 text-center">Pagamentos</th>
                    <th class="px-5 py-2.5">Arrecadado</th>
                    <th class="px-5 py-2.5">Sua Comissão</th>
                    <th class="px-5 py-2.5">Repasse Subconta</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="evento in org.eventos" :key="evento.eventoId" class="hover:bg-slate-50 transition">
                    <td class="px-5 py-3 font-bold text-slate-800">{{ evento.nome }}</td>
                    <td class="px-5 py-3 text-center text-slate-600">{{ evento.quantidadePagamentos }}</td>
                    <td class="px-5 py-3 font-semibold text-slate-700">{{ formatarValor(evento.totalArrecadado) }}</td>
                    <td class="px-5 py-3 font-black text-emerald-600">{{ formatarValor(evento.comissaoPlataforma) }}</td>
                    <td class="px-5 py-3 text-slate-700">{{ formatarValor(evento.repasse) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
