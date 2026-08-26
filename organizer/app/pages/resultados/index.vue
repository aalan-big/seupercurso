<script setup lang="ts">
import { Download, Medal, GraduationCap, AlertTriangle, CheckCircle, BarChart2, Flag, Zap } from 'lucide-vue-next'

const { eventos, fetchMeusEventos } = useEventoOrganizador()
const { resultados, fetchResultados, importarResultados, gerarCertificados } = useResultadosOrganizador()

const eventoSelecionadoId = ref('')
const carregandoEventos = ref(true)
const carregandoResultados = ref(false)
const importando = ref(false)
const gerando = ref(false)
const erro = ref('')
const sucesso = ref('')
const relatorioImportacao = ref<{ totalLinhas: number; processados: number; erros: { linha: number; motivo: string }[] } | null>(null)

const statusInfo: Record<string, { texto: string; classe: string }> = {
  FINALIZADO: { texto: 'Finalizado', classe: 'bg-emerald-100 text-emerald-800 font-bold' },
  DNF: { texto: 'DNF (Não Terminou)', classe: 'bg-amber-100 text-amber-900 font-bold' },
  DNS: { texto: 'DNS (Não Largou)', classe: 'bg-slate-100 text-slate-600' },
  DESCLASSIFICADO: { texto: 'Desclassificado', classe: 'bg-red-100 text-red-800 font-bold' }
}

onMounted(async () => {
  try {
    await fetchMeusEventos()
    if (eventos.value.length > 0) {
      eventoSelecionadoId.value = eventos.value[0].id
      await carregarResultados()
    }
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoEventos.value = false
  }
})

async function carregarResultados() {
  if (!eventoSelecionadoId.value) return
  erro.value = ''
  carregandoResultados.value = true
  try {
    await fetchResultados(eventoSelecionadoId.value)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoResultados.value = false
  }
}

async function onImportar(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo || !eventoSelecionadoId.value) return

  erro.value = ''
  relatorioImportacao.value = null
  importando.value = true
  try {
    relatorioImportacao.value = await importarResultados(eventoSelecionadoId.value, arquivo)
    await carregarResultados()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    importando.value = false
    input.value = ''
  }
}

async function onGerarCertificados() {
  erro.value = ''
  sucesso.value = ''
  gerando.value = true
  try {
    const res = await gerarCertificados(eventoSelecionadoId.value)
    relatorioImportacao.value = null
    sucesso.value = `${res.gerados} certificado(s) gerado(s) com sucesso!`
    await carregarResultados()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    gerando.value = false
  }
}

function baixarPlanilhaModeloCSV() {
  const csvHeaders = 'NumeroPeito;CPF;TempoBruto;TempoLiquido;ColocacaoGeral;ColocacaoCategoria;ColocacaoGenero;Status\n'
  const csvSample1 = '101;12345678900;00:45:30;00:45:22;1;1;1;FINALIZADO\n'
  const csvSample2 = '102;98765432100;00:48:10;00:48:01;2;2;2;FINALIZADO\n'
  const csvSample3 = '103;11122233344;00:52:00;00:51:45;3;1;3;FINALIZADO\n'

  const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvHeaders + csvSample1 + csvSample2 + csvSample3)
  const link = document.createElement('a')
  link.setAttribute('href', csvContent)
  link.setAttribute('download', 'Modelo_Cronometragem_Resultados_SeuPercurso.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function formatarTempo(segundos: number | null) {
  if (segundos === null) return '—'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

const concluintes = computed(() => resultados.value.filter((r) => r.status === 'FINALIZADO').length)
const certificadosEmitidos = computed(() => resultados.value.filter((r) => r.inscricao.certificado).length)
const melhorTempo = computed(() => {
  const tempos = resultados.value
    .map((r) => r.tempoLiquidoSegundos)
    .filter((t): t is number => t !== null && t > 0)
  if (tempos.length === 0) return '—'
  return formatarTempo(Math.min(...tempos))
})
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho Principal -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-primary">Resultados e Certificados Digitais</h1>
        <p class="mt-1 text-xs text-slate-500">
          Importe a planilha de tempos da cronometragem, organize a classificação e emita os certificados digitais dos atletas.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition"
          @click="baixarPlanilhaModeloCSV"
        >
          <Download :size="16" /> Baixar Planilha Modelo (.CSV)
        </button>
      </div>
    </div>

    <p v-if="carregandoEventos" class="text-xs text-slate-400">Carregando eventos...</p>

    <template v-else-if="eventos.length === 0">
      <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
        <Medal :size="36" class="mx-auto text-slate-400" />
        <p class="font-bold text-sm text-slate-700">Você ainda não possui eventos cadastrados.</p>
      </div>
    </template>

    <template v-else>
      <!-- Seletor do Evento e Ações Principais -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="w-full sm:w-72">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Selecione o Evento</label>
            <select
              v-model="eventoSelecionadoId"
              class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              @change="carregarResultados"
            >
              <option v-for="evento in eventos" :key="evento.id" :value="evento.id">{{ evento.nome }}</option>
            </select>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-4 sm:pt-0">
            <label
              class="inline-flex items-center gap-2 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800 transition"
            >
              <Download :size="14" /> <span>{{ importando ? 'Importando Planilha...' : 'Importar Resultados (CSV)' }}</span>
              <input type="file" accept=".csv,text/csv" class="hidden" :disabled="importando" @change="onImportar" />
            </label>

            <button
              type="button"
              :disabled="gerando || resultados.length === 0"
              class="inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-xs font-black uppercase tracking-wider text-primary shadow hover:brightness-95 transition disabled:opacity-40"
              @click="onGerarCertificados"
            >
              <GraduationCap :size="14" /> <span>{{ gerando ? 'Gerando Certificados...' : 'Gerar Certificados em Massa' }}</span>
            </button>
          </div>
        </div>

        <div class="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 flex items-center justify-between">
          <span>ℹ️ <strong>Formato das colunas no CSV:</strong> <code>NumeroPeito;CPF;TempoBruto;TempoLiquido;ColocacaoGeral;ColocacaoCategoria;ColocacaoGenero;Status</code></span>
        </div>
      </div>

      <!-- Alertas de Feedback -->
      <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 flex items-center gap-2">
        <AlertTriangle :size="16" class="text-red-600" /> {{ erro }}
      </p>
      <p v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
        <CheckCircle :size="16" class="text-emerald-600" /> {{ sucesso }}
      </p>

      <div
        v-if="relatorioImportacao"
        class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1"
      >
        <p class="font-bold flex items-center gap-1.5"><BarChart2 :size="14" /> Importação Concluída: {{ relatorioImportacao.processados }} de {{ relatorioImportacao.totalLinhas }} atletas processados com sucesso.</p>
        <div v-if="relatorioImportacao.erros.length > 0" class="mt-2 text-red-700 space-y-0.5">
          <p v-for="e in relatorioImportacao.erros" :key="e.linha" class="flex items-center gap-1.5"><AlertTriangle :size="12" class="text-red-600 shrink-0" /> Linha {{ e.linha }}: {{ e.motivo }}</p>
        </div>
      </div>

      <!-- KPIs da Prova -->
      <div v-if="resultados.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Atletas Concluintes</span>
            <p class="text-2xl font-black text-slate-900 mt-1 flex items-center gap-1.5"><Flag :size="20" /> {{ concluintes }}</p>
          </div>
          <span class="text-xs font-bold bg-slate-100 px-2.5 py-1 rounded-full text-slate-600">Finishers</span>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Melhor Tempo Geral</span>
            <p class="text-2xl font-black text-amber-600 mt-1 flex items-center gap-1.5"><Zap :size="20" /> {{ melhorTempo }}</p>
          </div>
          <span class="text-xs font-bold bg-amber-50 px-2.5 py-1 rounded-full text-amber-700">Pace Ouro</span>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Certificados Emitidos</span>
            <p class="text-2xl font-black text-emerald-600 mt-1 flex items-center gap-1.5"><GraduationCap :size="20" /> {{ certificadosEmitidos }}</p>
          </div>
          <span class="text-xs font-bold bg-emerald-50 px-2.5 py-1 rounded-full text-emerald-700">Disponíveis</span>
        </div>
      </div>

      <!-- Lista de Resultados / Pódio -->
      <div v-if="carregandoResultados" class="py-12 text-center text-xs text-slate-400">
        Carregando resultados da prova...
      </div>

      <div v-else-if="resultados.length === 0" class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-2">
        <Medal :size="36" class="mx-auto text-slate-400" />
        <p class="font-bold text-sm text-slate-700">Nenhum resultado lançado ainda para este evento.</p>
        <p class="text-xs text-slate-400">Clique no botão "Importar Resultados (CSV)" para carregar os tempos da cronometragem.</p>
      </div>

      <div v-else class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-3.5 text-center">Geral</th>
              <th class="px-4 py-3.5">Nº Peito</th>
              <th class="px-4 py-3.5">Nome do Atleta</th>
              <th class="px-4 py-3.5">Categoria</th>
              <th class="px-4 py-3.5">Tempo Líquido</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Certificado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="resultado in resultados"
              :key="resultado.id"
              class="hover:bg-slate-50 transition"
              :class="resultado.colocacaoGeral === 1 ? 'bg-amber-50/40' : resultado.colocacaoGeral === 2 ? 'bg-slate-50/80' : resultado.colocacaoGeral === 3 ? 'bg-amber-900/5' : ''"
            >
              <td class="px-4 py-3.5 text-center font-bold">
                <Medal v-if="resultado.colocacaoGeral === 1" :size="18" class="inline text-yellow-500" title="1º Lugar Geral" />
                <Medal v-else-if="resultado.colocacaoGeral === 2" :size="18" class="inline text-slate-400" title="2º Lugar Geral" />
                <Medal v-else-if="resultado.colocacaoGeral === 3" :size="18" class="inline text-amber-700" title="3º Lugar Geral" />
                <span v-else class="text-slate-600">{{ resultado.colocacaoGeral ?? '—' }}º</span>
              </td>
              <td class="px-4 py-3.5 font-mono font-bold text-slate-700">#{{ resultado.inscricao.numeroPeito || '—' }}</td>
              <td class="px-4 py-3.5 font-bold text-slate-900">{{ resultado.inscricao.cliente.pf?.nomeCompleto || '—' }}</td>
              <td class="px-4 py-3.5 text-slate-600">{{ resultado.inscricao.categoria.nome }}</td>
              <td class="px-4 py-3.5 font-mono font-black text-slate-800">{{ formatarTempo(resultado.tempoLiquidoSegundos) }}</td>
              <td class="px-4 py-3.5 text-center">
                <span
                  class="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                  :class="statusInfo[resultado.status]?.classe || 'bg-slate-100 text-slate-500'"
                >
                  {{ statusInfo[resultado.status]?.texto || resultado.status }}
                </span>
              </td>
              <td class="px-4 py-3.5 text-center">
                <span v-if="resultado.inscricao.certificado" class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                  <CheckCircle :size="12" /> Emitido
                </span>
                <span v-else class="text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
