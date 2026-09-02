<script setup lang="ts">
import { BarChart2, CheckCircle, Settings, AlertTriangle, DollarSign, Tag, Banknote, Ticket, Circle, CreditCard, Zap } from 'lucide-vue-next'
import type { FinanceiroOrganizador } from '../../composables/useFinanceiroOrganizador'

const { buscar } = useFinanceiroOrganizador()
const { organizador, fetchMe } = useOrganizador()
const api = useApi()

const financeiro = ref<FinanceiroOrganizador | null>(null)
const carregando = ref(true)
const erro = ref('')

// Conexao com o Mercado Pago. Nao existe mais saque aqui: o dinheiro cai
// direto na conta do organizador e ele saca no proprio Mercado Pago.
const { obterUrlAutorizacao, desconectar } = useMercadoPagoConexao()
const conectando = ref(false)
const erroConexao = ref('')

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    await fetchMe()
    financeiro.value = await buscar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function conectarMercadoPago() {
  erroConexao.value = ''
  conectando.value = true
  try {
    const { url } = await obterUrlAutorizacao()
    window.location.href = url
  } catch (e) {
    erroConexao.value = extrairErro(e)
    conectando.value = false
  }
}

async function desconectarMercadoPago() {
  if (
    !confirm(
      'Ao desconectar, seus eventos param de vender até você conectar de novo. Confirma?'
    )
  ) {
    return
  }

  erroConexao.value = ''
  try {
    await desconectar()
    await carregar()
  } catch (e) {
    erroConexao.value = extrairErro(e)
  }
}

function exportarRelatorioCSV() {
  if (!financeiro.value || financeiro.value.porEvento.length === 0) return

  let csvContent = 'data:text/csv;charset=utf-8,'
  csvContent += 'Evento,Inscrições Pagas,Total Arrecadado (R$),Comissão Plataforma (R$),Valor Líquido a Receber (R$)\n'

  financeiro.value.porEvento.forEach((ev) => {
    csvContent += `"${ev.nome.replace(/"/g, '""')}",${ev.quantidadePagamentos},${ev.totalArrecadado.toFixed(2)},${ev.comissaoPlataforma.toFixed(2)},${ev.repasse.toFixed(2)}\n`
  })

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `Relatorio_Financeiro_SeuPercurso_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho Principal do Dashboard Financeiro -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-primary">Dashboard Financeiro & Vendas</h1>
        <p class="mt-1 text-xs text-slate-500">
          Acompanhe suas vendas de inscrições e o quanto já entrou na sua conta do Mercado Pago.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          :disabled="!financeiro || financeiro.porEvento.length === 0"
          class="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition disabled:opacity-40"
          @click="exportarRelatorioCSV"
        >
          <BarChart2 :size="16" /> Exportar Relatório (CSV)
        </button>
      </div>
    </div>

    <p v-if="carregando" class="py-12 text-center text-sm text-slate-400">Carregando...</p>

    <p
      v-else-if="erro"
      class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ erro }}
    </p>

    <template v-else-if="financeiro">
      <!-- 4 Cards KPI Executivos -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Card 1: Total Arrecadado -->
        <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Total Arrecadado (Bruto)</span>
            <span class="rounded-lg bg-blue-50 p-2 text-blue-600"><DollarSign :size="16" /></span>
          </div>
          <p class="mt-3 text-2xl font-black text-slate-900">{{ formatarValor(financeiro.totalArrecadado) }}</p>
          <p class="mt-1 text-[11px] text-slate-500">Valor bruto de todas as inscrições</p>
        </div>

        <!-- Card 2: Comissão Plataforma -->
        <div class="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Comissão Plataforma ({{ financeiro.comissaoPercentual }}%)</span>
            <span class="rounded-lg bg-amber-50 p-2 text-amber-600"><Tag :size="16" /></span>
          </div>
          <p class="mt-3 text-2xl font-black text-slate-700">{{ formatarValor(financeiro.comissaoPlataforma) }}</p>
          <p class="mt-1 text-[11px] text-slate-500">Taxa de intermediação do sistema</p>
        </div>

        <!-- Card 3 & 4: repasse acumulado + estado da conexão -->
        <div
          class="relative overflow-hidden rounded-2xl border p-5 shadow-sm sm:col-span-2 flex flex-col justify-between space-y-3"
          :class="financeiro.contaConectada
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white'
            : 'border-amber-200 bg-gradient-to-br from-amber-500 to-amber-600 text-white'"
        >
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-white/80">
                Você recebeu
              </span>
              <span class="rounded-lg bg-white/20 p-2 text-white">
                <component :is="financeiro.contaConectada ? CheckCircle : AlertTriangle" :size="16" />
              </span>
            </div>
            <p class="mt-2 text-3xl font-black text-white">{{ formatarValor(financeiro.totalRepasse) }}</p>
            <p class="mt-1 text-[11px] text-white/85">
              Direto na sua conta do Mercado Pago, a cada inscrição paga. O saque é feito
              por lá, no app ou site do Mercado Pago.
            </p>
            <p
              v-if="financeiro.totalTaxaGateway > 0"
              class="mt-1 text-[11px] text-white/80"
            >
              As tarifas do gateway ({{ formatarValor(financeiro.totalTaxaGateway) }}) já
              estão embutidas no valor pago pelo atleta.
            </p>
            <p v-if="financeiro.pendencia" class="mt-2 rounded-lg bg-white/15 px-3 py-2 text-[11px] font-semibold leading-relaxed">
              {{ financeiro.pendencia }}
            </p>
          </div>

          <p v-if="erroConexao" class="rounded-lg bg-white/15 px-3 py-2 text-[11px] font-bold">
            {{ erroConexao }}
          </p>

          <button
            v-if="!financeiro.contaConectada"
            type="button"
            :disabled="conectando"
            class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-black uppercase tracking-wider text-amber-950 shadow hover:bg-amber-50 transition active:scale-[0.99] disabled:opacity-50"
            @click="conectarMercadoPago"
          >
            <Banknote :size="16" />
            <span>{{ conectando ? 'Abrindo o Mercado Pago...' : 'Conectar conta do Mercado Pago' }}</span>
          </button>

          <button
            v-else
            type="button"
            class="w-full rounded-xl border border-white/40 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white/90 transition hover:bg-white/10"
            @click="desconectarMercadoPago"
          >
            Desconectar conta
          </button>
        </div>
      </div>

      <!-- Guia de Prazos de Liquidação e Compensação -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div class="flex items-start gap-3.5 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 md:pr-4">
          <div class="rounded-xl bg-emerald-100 p-2 text-emerald-700 shrink-0">
            <Zap :size="20" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-xs font-black uppercase text-slate-800">Pagamentos via PIX</h3>
              <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">D+0 (Na hora)</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">
              O dinheiro cai na sua conta do Mercado Pago assim que o atleta paga.
            </p>
          </div>
        </div>

        <div class="flex items-start gap-3.5">
          <div class="rounded-xl bg-blue-100 p-2 text-blue-700 shrink-0">
            <CreditCard :size="20" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-xs font-black uppercase text-slate-800">Pagamentos via Cartão de Crédito</h3>
              <span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800">D+30</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">
              O prazo de liberação segue o que estiver configurado na sua conta do Mercado Pago —
              você ajusta isso em Custos, no app deles.
            </p>
          </div>
        </div>
      </div>

      <!-- Tabela Detalhada por Evento -->
      <div class="space-y-3 pt-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-black uppercase tracking-wider text-slate-700">Detalhamento e Repasses por Evento</h2>
          <span class="text-xs text-slate-400">Valores consolidados em BRL</span>
        </div>

        <div v-if="financeiro.porEvento.length === 0" class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-2">
          <BarChart2 :size="36" class="mx-auto text-slate-400" />
          <p class="font-bold text-sm text-slate-700">Nenhum pagamento aprovado até o momento.</p>
          <p class="text-xs text-slate-400">Assim que as inscrições forem confirmadas pelo atleta via PIX ou Cartão, os repasses aparecerão aqui.</p>
        </div>

        <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table class="w-full text-left text-xs">
            <thead class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th class="px-5 py-3.5">Nome do Evento</th>
                <th class="px-5 py-3.5 text-center">Inscrições Pagas</th>
                <th class="px-5 py-3.5">Valor Bruto</th>
                <th class="px-5 py-3.5">Taxa Plataforma</th>
                <th class="px-5 py-3.5">Líquido a Receber</th>
                <th class="px-5 py-3.5 text-center">Status Repasse</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="evento in financeiro.porEvento"
                :key="evento.eventoId"
                class="hover:bg-slate-50/80 transition"
              >
                <td class="px-5 py-4 font-bold text-slate-900">
                  <NuxtLink :to="`/eventos/${evento.eventoId}`" class="hover:text-primary transition">
                    {{ evento.nome }}
                  </NuxtLink>
                </td>
                <td class="px-5 py-4 text-center">
                  <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                    <Ticket :size="13" /> {{ evento.quantidadePagamentos }}
                  </span>
                </td>
                <td class="px-5 py-4 font-semibold text-slate-800">{{ formatarValor(evento.totalArrecadado) }}</td>
                <td class="px-5 py-4 text-slate-500">{{ formatarValor(evento.comissaoPlataforma) }}</td>
                <td class="px-5 py-4 font-black text-emerald-600">{{ formatarValor(evento.repasse) }}</td>
                <td class="px-5 py-4 text-center">
                  <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                    <Circle :size="10" class="fill-emerald-500 text-emerald-500" /> D+0 PIX / D+30 Cartão
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

  </div>
</template>
