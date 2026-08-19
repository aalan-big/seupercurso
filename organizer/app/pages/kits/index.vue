<script setup lang="ts">
const { eventos, fetchMeusEventos } = useEventoOrganizador()
const { kits, fetchKits, gerarNumeracaoPeito } = useKitsOrganizador()

const eventoSelecionadoId = ref('')
const carregandoEventos = ref(true)
const carregandoKits = ref(false)
const gerandoNumeros = ref(false)
const numeroInicialInput = ref(101)
const erro = ref('')
const sucesso = ref('')

const ORDEM_TAMANHOS = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'Não informado']

function ordenarTamanhos(tamanhos: Record<string, number>) {
  return Object.entries(tamanhos).sort(([a], [b]) => {
    const posA = ORDEM_TAMANHOS.indexOf(a)
    const posB = ORDEM_TAMANHOS.indexOf(b)
    if (posA === -1 && posB === -1) return a.localeCompare(b)
    if (posA === -1) return 1
    if (posB === -1) return -1
    return posA - posB
  })
}

const tamanhosOrdenados = computed(() => (kits.value ? ordenarTamanhos(kits.value.totalPorTamanho) : []))

onMounted(async () => {
  try {
    await fetchMeusEventos()
    if (eventos.value.length > 0) {
      eventoSelecionadoId.value = eventos.value[0].id
      await carregarKits()
    }
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoEventos.value = false
  }
})

async function carregarKits() {
  if (!eventoSelecionadoId.value) return
  erro.value = ''
  sucesso.value = ''
  carregandoKits.value = true
  try {
    await fetchKits(eventoSelecionadoId.value)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoKits.value = false
  }
}

async function onGerarNumeracao() {
  if (!eventoSelecionadoId.value) return
  erro.value = ''
  sucesso.value = ''
  gerandoNumeros.value = true
  try {
    const res = await gerarNumeracaoPeito(eventoSelecionadoId.value, numeroInicialInput.value)
    sucesso.value = `Numeração concluída! ${res.totalNumerados} atleta(s) receberam numerais de #${res.numeroInicial} até #${res.numeroFinal}.`
    await carregarKits()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    gerandoNumeros.value = false
  }
}

function exportarRelatorioGraficaCSV() {
  if (!kits.value) return

  let csvContent = 'data:text/csv;charset=utf-8,'
  csvContent += 'RELATORIO DE KITS E ESTOQUE PARA GRAFICA\n'
  csvContent += `Evento,Total Geral Inscritos\n`
  const eventoNome = eventos.value.find((e) => e.id === eventoSelecionadoId.value)?.nome || ''
  csvContent += `"${eventoNome}",${kits.value.total}\n\n`

  csvContent += 'TAMANHOS DE CAMISAS (GERAL)\n'
  csvContent += 'Tamanho,Quantidade\n'
  tamanhosOrdenados.value.forEach(([tamanho, qty]) => {
    csvContent += `"${tamanho}",${qty}\n`
  })

  csvContent += '\nTAMANHOS POR MODALIDADE\n'
  csvContent += 'Modalidade,Tamanho,Quantidade\n'
  kits.value.porModalidade.forEach((mod) => {
    ordenarTamanhos(mod.tamanhos).forEach(([tamanho, qty]) => {
      csvContent += `"${mod.modalidade}","${tamanho}",${qty}\n`
    })
  })

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `Kits_E_Estoque_Grafica_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho Principal -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-primary">Kits, Estoque & Numeração de Peito</h1>
        <p class="mt-1 text-xs text-slate-500">
          Gerencie o estoque de camisetas para a gráfica e atribua números de peito em lote aos atletas.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          :disabled="!kits || kits.total === 0"
          class="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition disabled:opacity-40"
          @click="exportarRelatorioGraficaCSV"
        >
          📄 Exportar Pedido para Gráfica (CSV)
        </button>
      </div>
    </div>

    <!-- Explicação Didática da Numeração -->
    <div class="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 text-xs text-blue-900 flex flex-wrap items-center justify-between gap-4 shadow-xs">
      <div class="flex items-center gap-3">
        <span class="text-3xl">🎽</span>
        <div>
          <p class="font-bold text-sm text-blue-950">Como funciona a Atribuição dos Números de Peito?</p>
          <p class="text-[11px] text-blue-800 mt-0.5">
            <strong>1. Em Lote (Recomendado):</strong> Clique abaixo para gerar numerais em sequência automática (ex: #101, #102, #103...) para todos os confirmados.<br />
            <strong>2. No Balcão (Entrega de Kit):</strong> No momento do check-in com a câmera, o staff também pode digitar/alterar o número impresso na folha física.
          </p>
        </div>
      </div>
    </div>

    <p v-if="carregandoEventos" class="text-xs text-slate-400">Carregando eventos...</p>

    <template v-else-if="eventos.length === 0">
      <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
        <span class="text-4xl block">👕</span>
        <p class="font-bold text-sm text-slate-700">Você ainda não criou nenhum evento.</p>
      </div>
    </template>

    <template v-else>
      <!-- Seletor do Evento + Gerador de Numeração em Lote -->
      <div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="w-full sm:w-72">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Selecione o Evento</label>
            <select
              v-model="eventoSelecionadoId"
              class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-800 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              @change="carregarKits"
            >
              <option v-for="evento in eventos" :key="evento.id" :value="evento.id">{{ evento.nome }}</option>
            </select>
          </div>

          <!-- Card de Geração de Numerais -->
          <div class="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Número Inicial</label>
              <input
                v-model.number="numeroInicialInput"
                type="number"
                min="1"
                class="w-24 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono font-bold text-slate-800"
              />
            </div>

            <button
              type="button"
              :disabled="gerandoNumeros || !kits || kits.total === 0"
              class="mt-3.5 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:brightness-95 transition disabled:opacity-40"
              @click="onGerarNumeracao"
            >
              🔢 {{ gerandoNumeros ? 'Gerando Numerais...' : 'Atribuir Números em Lote' }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
        ⚠️ {{ erro }}
      </p>
      <p v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
        ✅ {{ sucesso }}
      </p>

      <p v-if="carregandoKits" class="py-8 text-center text-xs text-slate-400">Carregando estoque de kits...</p>

      <template v-else-if="kits">
        <p v-if="kits.total === 0" class="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-xs text-slate-500">
          Nenhuma inscrição confirmada ainda para este evento.
        </p>

        <template v-else>
          <!-- Resumo Geral de Camisetas por Tamanho -->
          <div class="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div class="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <p class="text-xs font-black uppercase tracking-wider text-slate-700">Total de Camisetas do Evento — {{ kits.total }} unidades</p>
              <span class="text-[11px] font-bold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">Resumo Gráfica</span>
            </div>
            <div class="grid grid-cols-3 gap-4 p-5 sm:grid-cols-6">
              <div v-for="[tamanho, quantidade] in tamanhosOrdenados" :key="tamanho" class="text-center rounded-xl bg-slate-50 p-3 border border-slate-100">
                <p class="text-2xl font-black text-primary">{{ quantidade }}</p>
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">{{ tamanho }}</p>
              </div>
            </div>
          </div>

          <!-- Por Modalidade -->
          <div class="space-y-3 pt-2">
            <h3 class="text-xs font-black uppercase tracking-wider text-slate-600">Demanda por Modalidade</h3>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div
                v-for="grupo in kits.porModalidade"
                :key="grupo.modalidadeId"
                class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
              >
                <p class="font-bold text-sm text-slate-900">{{ grupo.modalidade }}</p>
                <div class="mt-4 flex flex-wrap gap-3">
                  <div v-for="[tamanho, quantidade] in ordenarTamanhos(grupo.tamanhos)" :key="tamanho" class="text-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                    <p class="text-base font-bold text-primary">{{ quantidade }}</p>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">{{ tamanho }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
