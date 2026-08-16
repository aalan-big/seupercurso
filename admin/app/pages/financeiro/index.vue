<script setup lang="ts">
import type { FinanceiroAdmin } from '../../composables/useAdminFinanceiro'

const { buscar } = useAdminFinanceiro()

const financeiro = ref<FinanceiroAdmin | null>(null)
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
      Pagamento ainda é simulado — esses números refletem os registros de pagamento existentes no banco, não movimentação financeira real.
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
          <p class="text-2xl font-extrabold text-accent">{{ formatarValor(financeiro.comissaoPlataforma) }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Comissão da plataforma</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p class="text-2xl font-extrabold text-secondary">{{ formatarValor(financeiro.totalRepasse) }}</p>
          <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">A repassar aos organizadores</p>
        </div>
      </div>

      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">Por organizador</h2>

      <div v-if="financeiro.porOrganizador.length === 0" class="mt-3 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Nenhum pagamento aprovado ainda.
      </div>

      <div v-else class="mt-3 flex flex-col gap-4">
        <div
          v-for="org in financeiro.porOrganizador"
          :key="org.organizadorId"
          class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p class="font-bold text-slate-800">{{ org.nome }}</p>
              <p class="text-xs text-slate-400">{{ org.quantidadePagamentos }} pagamento(s) · {{ org.eventos.length }} evento(s)</p>
            </div>
            <div class="flex gap-4 text-right text-sm">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Arrecadado</p>
                <p class="font-bold text-slate-700">{{ formatarValor(org.totalArrecadado) }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Comissão</p>
                <p class="font-bold text-accent">{{ formatarValor(org.comissaoPlataforma) }}</p>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Repasse</p>
                <p class="font-bold text-secondary">{{ formatarValor(org.repasse) }}</p>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="text-xs font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th class="px-4 py-2">Evento</th>
                  <th class="px-4 py-2">Pagamentos</th>
                  <th class="px-4 py-2">Arrecadado</th>
                  <th class="px-4 py-2">Comissão</th>
                  <th class="px-4 py-2">Repasse</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="evento in org.eventos" :key="evento.eventoId" class="border-t border-slate-100">
                  <td class="px-4 py-2 text-slate-700">{{ evento.nome }}</td>
                  <td class="px-4 py-2 text-slate-600">{{ evento.quantidadePagamentos }}</td>
                  <td class="px-4 py-2 text-slate-600">{{ formatarValor(evento.totalArrecadado) }}</td>
                  <td class="px-4 py-2 text-accent">{{ formatarValor(evento.comissaoPlataforma) }}</td>
                  <td class="px-4 py-2 text-secondary">{{ formatarValor(evento.repasse) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
