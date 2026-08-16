<script setup lang="ts">
import type { FinanceiroOrganizador } from '../../composables/useFinanceiroOrganizador'

const { buscar } = useFinanceiroOrganizador()

const financeiro = ref<FinanceiroOrganizador | null>(null)
const carregando = ref(true)
const erro = ref('')

onMounted(async () => {
  erro.value = ''
  carregando.value = true
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
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Financeiro</h1>
    <p class="mt-1 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
      Pagamento ainda é simulado — esses números refletem os pagamentos aprovados registrados no sistema, não repasse real.
    </p>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="financeiro">
      <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-2xl font-extrabold text-primary">{{ formatarValor(financeiro.totalArrecadado) }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Total arrecadado</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-2xl font-extrabold text-slate-500">{{ formatarValor(financeiro.comissaoPlataforma) }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Comissão da plataforma ({{ financeiro.comissaoPercentual }}%)</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-2xl font-extrabold text-accent">{{ formatarValor(financeiro.totalRepasse) }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Valor a receber</p>
        </div>
      </div>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Por evento</h2>

      <div v-if="financeiro.porEvento.length === 0" class="mt-3 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Nenhum pagamento aprovado ainda.
      </div>

      <div v-else class="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Evento</th>
              <th class="px-4 py-3">Pagamentos</th>
              <th class="px-4 py-3">Arrecadado</th>
              <th class="px-4 py-3">Comissão</th>
              <th class="px-4 py-3">A receber</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="evento in financeiro.porEvento" :key="evento.eventoId" class="border-b border-slate-100 last:border-0">
              <td class="px-4 py-3 font-semibold text-slate-700">{{ evento.nome }}</td>
              <td class="px-4 py-3 text-slate-600">{{ evento.quantidadePagamentos }}</td>
              <td class="px-4 py-3 text-slate-600">{{ formatarValor(evento.totalArrecadado) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ formatarValor(evento.comissaoPlataforma) }}</td>
              <td class="px-4 py-3 text-accent">{{ formatarValor(evento.repasse) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
