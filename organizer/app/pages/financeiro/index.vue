<script setup lang="ts">
import { BarChart2, CheckCircle, PartyPopper, Settings, AlertTriangle, DollarSign, Tag, Lock, Banknote, Ticket, Circle, X, Zap } from 'lucide-vue-next'
import type { FinanceiroOrganizador } from '../../composables/useFinanceiroOrganizador'

const { buscar } = useFinanceiroOrganizador()
const { organizador, fetchMe } = useOrganizador()
const api = useApi()

const financeiro = ref<FinanceiroOrganizador | null>(null)
const carregando = ref(true)
const erro = ref('')

// Modal Saque State
const modalSaqueAberto = ref(false)
const solicitandoSaque = ref(false)
const erroSaque = ref('')
const comprovanteSaque = ref<{ transferId: string; chaveDestino: string; valor: number; saldoRestante?: number } | null>(null)

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

const valorSaque = ref<number | string>('')

const saqueLiberado = computed(
  () => !!financeiro.value && !financeiro.value.bloqueioSaque && financeiro.value.saldoDisponivel > 0
)

watch(
  () => financeiro.value?.saldoDisponivel,
  (saldo) => {
    if (saldo && !valorSaque.value) valorSaque.value = saldo
  }
)

async function realizarSaquePix() {
  if (!financeiro.value || !saqueLiberado.value) return

  const valor = Number(valorSaque.value)
  if (!valor || valor <= 0) {
    erroSaque.value = 'Informe o valor a sacar.'
    return
  }
  if (valor > financeiro.value.saldoDisponivel) {
    erroSaque.value = 'Valor maior que o saldo disponível.'
    return
  }

  solicitandoSaque.value = true
  erroSaque.value = ''
  comprovanteSaque.value = null

  try {
    const res = await api<{ sucesso: boolean; transferId: string; chaveDestino: string; valor: number; saldoRestante?: number }>(
      '/organizadores/me/financeiro/saque',
      {
        method: 'POST',
        body: { valor }
      }
    )
    comprovanteSaque.value = res
    await carregar()
  } catch (e) {
    erroSaque.value = extrairErro(e)
  } finally {
    solicitandoSaque.value = false
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
          Acompanhe suas vendas de inscrições, o repasse líquido a receber e solicite seus saques via PIX.
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

    <!-- Banner da Subconta Asaas -->
    <div v-if="organizador?.asaasWalletId" class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-4 shadow-xs">
      <div class="flex items-center gap-3">
        <CheckCircle :size="28" class="text-emerald-600" />
        <div>
          <p class="font-bold text-sm text-emerald-950">Subconta Asaas Ativa & Verificada</p>
          <p class="text-[11px] text-emerald-800 mt-0.5">
            Sua conta de repasse automático (Wallet: <code class="font-mono font-bold">{{ organizador.asaasWalletId }}</code>) está apta a receber solicitações de saques instantâneos via PIX.
          </p>
        </div>
      </div>
      <NuxtLink to="/dados-bancarios" class="rounded-xl bg-white/90 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200 hover:bg-white transition inline-flex items-center gap-1.5">
        <Settings :size="14" /> Ver Dados Bancários
      </NuxtLink>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
      <AlertTriangle :size="16" class="text-red-600" /> {{ erro }}
    </p>

    <div v-if="carregando" class="py-12 text-center text-xs text-slate-400">
      Carregando métricas financeiras...
    </div>

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

        <!-- Card 3 & 4: Saldo Líquido a Receber + Botão de Saque com Trava de Titularidade -->
        <div class="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-sm transition hover:shadow-md sm:col-span-2 flex flex-col justify-between space-y-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-100">Saldo Líquido Disponível</span>
              <span class="rounded-lg bg-white/20 p-2 text-white"><Lock :size="16" /></span>
            </div>
            <p class="mt-2 text-3xl font-black text-white">{{ formatarValor(financeiro.saldoDisponivel) }}</p>
            <p class="mt-1 text-[11px] text-emerald-100 flex items-center gap-1.5">
              <Lock :size="12" /> Saldo na sua subconta Asaas — saque só para o CPF/CNPJ cadastrado
            </p>
            <p v-if="financeiro.bloqueioSaque" class="mt-2 rounded-lg bg-white/15 px-3 py-2 text-[11px] font-semibold leading-relaxed">
              {{ financeiro.bloqueioSaque }}
            </p>
          </div>

          <!-- Botão de Saque em Destaque -->
          <button
            type="button"
            :disabled="!saqueLiberado"
            class="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-xs font-black uppercase tracking-wider text-emerald-950 shadow hover:bg-emerald-50 transition active:scale-[0.99] disabled:opacity-50"
            @click="modalSaqueAberto = true"
          >
            <Banknote :size="16" /> <span>Solicitar Saque via PIX</span>
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
              O dinheiro cai na sua subconta Asaas assim que o atleta paga e já fica liberado para saque.
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
              Liberado em <strong>30 dias</strong> na compra à vista, ou uma parcela a cada 30 dias
              no parcelado. O saldo só aparece como disponível depois da liberação pelo Asaas.
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

    <!-- MODAL DE SAQUE VIA PIX -->
    <Teleport to="body">
      <div v-if="modalSaqueAberto && financeiro" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="modalSaqueAberto = false"></div>

        <div class="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl z-[301] p-6 space-y-5">
          <div class="flex items-center justify-between border-b border-slate-100 pb-3">
            <div class="flex items-center gap-2">
              <Banknote :size="22" class="text-emerald-600" />
              <div>
                <h3 class="font-black text-sm text-slate-900">Solicitar Saque do Saldo Líquido</h3>
                <p class="text-[11px] text-slate-500">Transferência via PIX da Subconta Asaas</p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-xl bg-slate-100 p-2 text-xs font-bold text-slate-500 hover:bg-slate-200 transition inline-flex items-center gap-1"
              @click="modalSaqueAberto = false"
            >
              <X :size="13" /> Fechar
            </button>
          </div>

          <div v-if="erroSaque" class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle :size="14" class="text-red-600" /> {{ erroSaque }}
          </div>

          <!-- Comprovante de Sucesso -->
          <div v-if="comprovanteSaque" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-2 text-center">
            <PartyPopper :size="36" class="mx-auto text-emerald-600" />
            <p class="font-black text-sm text-emerald-950">Saque Solicitado com Sucesso!</p>
            <p class="text-[11px] text-emerald-800">
              O valor de <strong>{{ formatarValor(comprovanteSaque.valor) }}</strong> foi enviado para processamento no Asaas e cairá na sua chave PIX:
            </p>
            <div class="bg-white/80 p-2 rounded-xl border border-emerald-200 font-mono font-bold text-emerald-900">
              {{ comprovanteSaque.chaveDestino }}
            </div>
            <p class="text-[10px] text-slate-400 font-mono pt-1">ID Transação: {{ comprovanteSaque.transferId }}</p>
          </div>

          <div v-else class="space-y-4 text-xs">
            <div class="rounded-2xl bg-emerald-50 p-4 border border-emerald-200 space-y-1 text-center">
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-800">Valor Total Disponível</span>
              <p class="text-3xl font-black text-emerald-900">{{ formatarValor(financeiro.saldoDisponivel) }}</p>
            </div>

            <div>
              <label class="mb-1 block text-[11px] font-bold uppercase text-slate-600">Valor a sacar</label>
              <input
                v-model="valorSaque"
                type="number"
                min="0.01"
                step="0.01"
                :max="financeiro.saldoDisponivel"
                class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div class="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
              <div class="flex justify-between gap-3">
                <span class="font-bold text-slate-500 shrink-0">Destino:</span>
                <span class="font-bold text-slate-900 text-right">
                  Chave PIX do seu CPF/CNPJ cadastrado
                </span>
              </div>
              <div class="flex justify-between">
                <span class="font-bold text-slate-500">Taxa de Saque:</span>
                <span class="font-bold text-emerald-700">Isento (Gratuito)</span>
              </div>
            </div>

            <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
              <strong>Por que não dá para escolher a conta:</strong> a transferência sai sempre
              para a chave PIX do CPF/CNPJ do seu cadastro, em qualquer banco. Assim o próprio
              sistema bancário garante que o dinheiro cai em conta sua, e não de terceiros.
              Para trocar o CPF/CNPJ é preciso abrir uma solicitação com foto do documento.
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
            <button
              v-if="!comprovanteSaque"
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              @click="modalSaqueAberto = false"
            >
              Cancelar
            </button>

            <button
              v-if="comprovanteSaque"
              type="button"
              class="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white transition"
              @click="modalSaqueAberto = false"
            >
              Concluir
            </button>

            <button
              v-else
              type="button"
              :disabled="solicitandoSaque"
              class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-40"
              @click="realizarSaquePix"
            >
              <Zap :size="14" /> {{ solicitandoSaque ? 'Processando Saque...' : 'Confirmar Transferência PIX' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
