<script setup lang="ts">
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
  FINALIZADO: { texto: 'Finalizado', classe: 'bg-accent/10 text-accent' },
  DNF: { texto: 'DNF', classe: 'bg-warning/10 text-warning' },
  DNS: { texto: 'DNS', classe: 'bg-slate-100 text-slate-500' },
  DESCLASSIFICADO: { texto: 'Desclassificado', classe: 'bg-red-50 text-red-600' }
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
    sucesso.value = `${res.gerados} certificado(s) gerado(s).`
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    gerando.value = false
  }
}

function formatarTempo(segundos: number | null) {
  if (segundos === null) return '—'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Resultados e certificados</h1>
    <p class="mt-1 text-sm text-slate-500">Importe a planilha de tempos da cronometragem e gere os certificados.</p>

    <p v-if="carregandoEventos" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="eventos.length === 0">
      <div class="mt-10 text-center">
        <div class="text-4xl">🏅</div>
        <p class="mt-3 text-slate-500">Você ainda não criou nenhum evento.</p>
      </div>
    </template>

    <template v-else>
      <div class="mt-6 flex flex-wrap items-end gap-3">
        <select
          v-model="eventoSelecionadoId"
          class="rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          @change="carregarResultados"
        >
          <option v-for="evento in eventos" :key="evento.id" :value="evento.id">{{ evento.nome }}</option>
        </select>

        <label
          class="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
        >
          {{ importando ? 'Importando...' : 'Importar planilha (CSV)' }}
          <input type="file" accept=".csv,text/csv" class="hidden" :disabled="importando" @change="onImportar" />
        </label>

        <button
          type="button"
          :disabled="gerando || resultados.length === 0"
          class="rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95 disabled:opacity-50"
          @click="onGerarCertificados"
        >
          {{ gerando ? 'Gerando...' : 'Gerar certificados' }}
        </button>
      </div>

      <p class="mt-2 text-xs text-slate-400">
        CSV com colunas: NumeroPeito;CPF;TempoBruto (hh:mm:ss);TempoLiquido;ColocacaoGeral;ColocacaoCategoria;ColocacaoGenero;Status
      </p>

      <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ erro }}
      </p>
      <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
        {{ sucesso }}
      </p>

      <div
        v-if="relatorioImportacao"
        class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent"
      >
        {{ relatorioImportacao.processados }} de {{ relatorioImportacao.totalLinhas }} linhas importadas.
        <template v-if="relatorioImportacao.erros.length > 0">
          <div class="mt-2 text-red-700">
            <p v-for="e in relatorioImportacao.erros" :key="e.linha">Linha {{ e.linha }}: {{ e.motivo }}</p>
          </div>
        </template>
      </div>

      <p v-if="carregandoResultados" class="mt-8 text-sm text-slate-500">Carregando...</p>

      <div v-else-if="resultados.length === 0" class="mt-10 text-center">
        <div class="text-4xl">🏅</div>
        <p class="mt-3 text-slate-500">Nenhum resultado lançado ainda pra esse evento.</p>
      </div>

      <div v-else class="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Peito</th>
              <th class="px-4 py-3">Nome</th>
              <th class="px-4 py-3">Categoria</th>
              <th class="px-4 py-3">Tempo líquido</th>
              <th class="px-4 py-3">Colocação geral</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Certificado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="resultado in resultados" :key="resultado.id" class="border-b border-slate-100 last:border-0">
              <td class="px-4 py-3 text-slate-500">{{ resultado.inscricao.numeroPeito || '—' }}</td>
              <td class="px-4 py-3 font-medium text-slate-800">{{ resultado.inscricao.cliente.pf?.nomeCompleto || '—' }}</td>
              <td class="px-4 py-3 text-slate-500">{{ resultado.inscricao.categoria.nome }}</td>
              <td class="px-4 py-3 text-slate-500">{{ formatarTempo(resultado.tempoLiquidoSegundos) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ resultado.colocacaoGeral ?? '—' }}</td>
              <td class="px-4 py-3">
                <span
                  class="whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                  :class="statusInfo[resultado.status]?.classe || 'bg-slate-100 text-slate-500'"
                >
                  {{ statusInfo[resultado.status]?.texto || resultado.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-slate-500">
                <span v-if="resultado.inscricao.certificado" class="text-accent">Emitido</span>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
