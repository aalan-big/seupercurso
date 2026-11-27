<script setup lang="ts">
import { ArrowLeft, Printer } from 'lucide-vue-next'
import type { RelatorioFinanceiroEvento } from '../../composables/useFinanceiroOrganizador'

const route = useRoute()
const { relatorioEvento } = useFinanceiroOrganizador()

const relatorio = ref<RelatorioFinanceiroEvento | null>(null)
const carregando = ref(true)
const erro = ref('')

onMounted(async () => {
  try {
    relatorio.value = await relatorioEvento(String(route.params.eventoId))
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

useHead(() => ({
  // O nome do arquivo ao salvar em PDF sai do titulo da pagina.
  title: relatorio.value ? `Relatório financeiro - ${relatorio.value.evento.nome}` : 'Relatório financeiro',
}))

const FORMAS: Record<string, string> = {
  PIX: 'PIX',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  BOLETO: 'Boleto',
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string, comHora = false) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(comHora ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: comHora ? undefined : 'UTC',
  })
}

function imprimir() {
  window.print()
}
</script>

<template>
  <div class="relatorio mx-auto max-w-5xl space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <NuxtLink
        to="/financeiro"
        class="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-primary transition"
      >
        <ArrowLeft :size="16" /> Voltar ao financeiro
      </NuxtLink>
      <button
        type="button"
        :disabled="!relatorio"
        class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:opacity-90 transition disabled:opacity-40"
        @click="imprimir"
      >
        <Printer :size="16" /> Imprimir / Salvar PDF
      </button>
    </div>

    <p v-if="carregando" class="py-12 text-center text-sm text-slate-400">Carregando...</p>

    <p v-else-if="erro" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <div v-else-if="relatorio" class="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 print:border-0 print:p-0">
      <!-- Cabeçalho -->
      <header class="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Relatório financeiro do evento</p>
          <h1 class="mt-1 text-xl font-black text-slate-900">{{ relatorio.evento.nome }}</h1>
          <p class="mt-1 text-xs text-slate-600">
            {{ formatarData(relatorio.evento.dataInicio) }} · {{ relatorio.evento.local }} —
            {{ relatorio.evento.cidade }}/{{ relatorio.evento.estado }}
          </p>
          <p v-if="relatorio.organizador" class="text-xs text-slate-600">Organizador: {{ relatorio.organizador }}</p>
        </div>
        <div class="text-right">
          <img src="/logo-header.png" alt="SeuPercurso" class="ml-auto h-7 w-auto" />
          <p class="mt-2 text-[10px] text-slate-500">Gerado em {{ formatarData(relatorio.geradoEm, true) }}</p>
        </div>
      </header>

      <!-- Resumo -->
      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-wider text-slate-700">Resumo</h2>
        <table class="w-full text-xs">
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-1.5 text-slate-600">Pagamentos aprovados</td>
              <td class="py-1.5 text-right font-semibold">{{ relatorio.resumo.quantidadePagamentos }}</td>
            </tr>
            <tr>
              <td class="py-1.5 text-slate-600">Inscrições confirmadas no evento</td>
              <td class="py-1.5 text-right font-semibold">{{ relatorio.resumo.inscricoesConfirmadas }}</td>
            </tr>
            <tr>
              <td class="py-1.5 text-slate-600">Total arrecadado (bruto)</td>
              <td class="py-1.5 text-right font-semibold">{{ formatarValor(relatorio.resumo.totalArrecadado) }}</td>
            </tr>
            <tr>
              <td class="py-1.5 text-slate-600">(−) Tarifas do Mercado Pago</td>
              <td class="py-1.5 text-right">{{ formatarValor(relatorio.resumo.taxaGateway) }}</td>
            </tr>
            <tr>
              <td class="py-1.5 text-slate-600">(−) Taxa da plataforma</td>
              <td class="py-1.5 text-right">{{ formatarValor(relatorio.resumo.comissaoPlataforma) }}</td>
            </tr>
            <tr class="border-t-2 border-slate-300">
              <td class="py-2 font-black text-slate-900">Líquido recebido</td>
              <td class="py-2 text-right text-sm font-black text-emerald-700 print:text-slate-900">
                {{ formatarValor(relatorio.resumo.repasse) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
        <!-- Por forma de pagamento -->
        <section>
          <h2 class="mb-2 text-xs font-black uppercase tracking-wider text-slate-700">Por forma de pagamento</h2>
          <p v-if="relatorio.porForma.length === 0" class="text-xs text-slate-500">Nenhum pagamento aprovado.</p>
          <table v-else class="w-full text-xs">
            <thead class="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th class="py-1.5 text-left">Forma</th>
                <th class="py-1.5 text-center">Qtd.</th>
                <th class="py-1.5 text-right">Bruto</th>
                <th class="py-1.5 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="f in relatorio.porForma" :key="f.metodo">
                <td class="py-1.5">{{ FORMAS[f.metodo] ?? f.metodo }}</td>
                <td class="py-1.5 text-center">{{ f.quantidade }}</td>
                <td class="py-1.5 text-right">{{ formatarValor(f.totalArrecadado) }}</td>
                <td class="py-1.5 text-right font-semibold">{{ formatarValor(f.repasse) }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Inscrições por modalidade -->
        <section>
          <h2 class="mb-2 text-xs font-black uppercase tracking-wider text-slate-700">Inscrições confirmadas por modalidade</h2>
          <p v-if="relatorio.porModalidade.length === 0" class="text-xs text-slate-500">Nenhuma inscrição confirmada.</p>
          <table v-else class="w-full text-xs">
            <thead class="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th class="py-1.5 text-left">Modalidade</th>
                <th class="py-1.5 text-center">Confirmadas</th>
                <th class="py-1.5 text-center">De outro site</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="m in relatorio.porModalidade" :key="m.modalidade">
                <td class="py-1.5">{{ m.modalidade }}</td>
                <td class="py-1.5 text-center">{{ m.confirmadas }}</td>
                <td class="py-1.5 text-center">{{ m.importadas || '—' }}</td>
              </tr>
            </tbody>
          </table>
          <p class="mt-1 text-[10px] text-slate-500">
            Inclui cortesias e isentos, que não geram pagamento. Inscrições "de outro site" foram pagas lá.
          </p>
        </section>
      </div>

      <!-- Pagamentos -->
      <section>
        <h2 class="mb-2 text-xs font-black uppercase tracking-wider text-slate-700">Pagamentos aprovados</h2>
        <p v-if="relatorio.pagamentos.length === 0" class="text-xs text-slate-500">Nenhum pagamento aprovado.</p>
        <div v-else class="overflow-x-auto print:overflow-visible">
          <table class="w-full text-[11px]">
            <thead class="border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
              <tr>
                <th class="py-1.5 pr-2 text-left">Data</th>
                <th class="py-1.5 pr-2 text-left">Atleta(s)</th>
                <th class="py-1.5 pr-2 text-left">Modalidade</th>
                <th class="py-1.5 pr-2 text-left">Forma</th>
                <th class="py-1.5 pr-2 text-right">Valor</th>
                <th class="py-1.5 pr-2 text-right">Tarifa MP</th>
                <th class="py-1.5 pr-2 text-right">Taxa site</th>
                <th class="py-1.5 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="p in relatorio.pagamentos" :key="p.id" class="break-inside-avoid">
                <td class="py-1.5 pr-2 whitespace-nowrap">{{ formatarData(p.data, true) }}</td>
                <td class="py-1.5 pr-2">
                  {{ p.atletas.join(', ') }}
                  <span
                    v-if="p.comprador !== '—' && !p.atletas.includes(p.comprador)"
                    class="block text-[10px] text-slate-500"
                  >comprado por {{ p.comprador }}</span>
                </td>
                <td class="py-1.5 pr-2">{{ p.modalidades.join('; ') }}</td>
                <td class="py-1.5 pr-2 whitespace-nowrap">{{ FORMAS[p.metodo] ?? p.metodo }}</td>
                <td class="py-1.5 pr-2 text-right whitespace-nowrap">{{ formatarValor(p.valor) }}</td>
                <td class="py-1.5 pr-2 text-right whitespace-nowrap">{{ formatarValor(p.taxaGateway) }}</td>
                <td class="py-1.5 pr-2 text-right whitespace-nowrap">{{ formatarValor(p.comissaoPlataforma) }}</td>
                <td class="py-1.5 text-right font-semibold whitespace-nowrap">{{ formatarValor(p.repasse) }}</td>
              </tr>
            </tbody>
            <tfoot class="border-t-2 border-slate-300 font-black">
              <tr>
                <td colspan="4" class="py-2">Total</td>
                <td class="py-2 pr-2 text-right whitespace-nowrap">{{ formatarValor(relatorio.resumo.totalArrecadado) }}</td>
                <td class="py-2 pr-2 text-right whitespace-nowrap">{{ formatarValor(relatorio.resumo.taxaGateway) }}</td>
                <td class="py-2 pr-2 text-right whitespace-nowrap">{{ formatarValor(relatorio.resumo.comissaoPlataforma) }}</td>
                <td class="py-2 text-right whitespace-nowrap">{{ formatarValor(relatorio.resumo.repasse) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <footer class="border-t border-slate-200 pt-3 text-[10px] leading-relaxed text-slate-500">
        Valores dos pagamentos aprovados até a data de geração. O dinheiro cai direto na conta do Mercado Pago do
        organizador: PIX na hora; cartão conforme o prazo configurado na conta do Mercado Pago.
      </footer>
    </div>
  </div>
</template>

<style>
@media print {
  @page {
    size: A4;
    margin: 12mm;
  }
  html,
  body {
    background: #fff !important;
  }
  .relatorio {
    max-width: none;
  }
  .relatorio thead {
    display: table-header-group;
  }
}
</style>
