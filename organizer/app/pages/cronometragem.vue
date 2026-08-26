<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Plug, FolderOpen, BarChart2, Key, Check, RefreshCw, Download, CheckCircle, AlertTriangle, Zap } from 'lucide-vue-next'
import { useEventoOrganizador } from '~/composables/useEventoOrganizador'
import { useCronometragem, type InscricaoComResultado } from '~/composables/useCronometragem'

const { eventos, fetchEventos } = useEventoOrganizador()
const { buscarInfo, gerarApiKey, importarCsv, listarResultados } = useCronometragem()

const config = useRuntimeConfig()
const apiBase = (config.public.apiBase as string) || 'http://localhost:3000'

const carregandoEventos = ref(true)
const eventoSelecionadoId = ref<string>('')
const abaAtiva = ref<'api' | 'csv' | 'resultados'>('api')

// Estado da API Key
const gerandoKey = ref(false)
const apiKeyAtual = ref<string | null>(null)
const copiadoKey = ref(false)
const copiadoUrl = ref(false)

// Estado da Importação CSV
const conteudoCsv = ref('')
const processandoCsv = ref(false)
const erroCsv = ref('')
const sucessoCsv = ref('')

// Estado da Tabela de Resultados
const carregandoResultados = ref(false)
const listaResultados = ref<InscricaoComResultado[]>([])
const busca = ref('')

const webhookUrl = computed(() => `${apiBase.replace(/\/$/, '')}/cronometragem/webhooks/resultados`)

onMounted(async () => {
  try {
    await fetchEventos()
    if (eventos.value.length > 0) {
      eventoSelecionadoId.value = eventos.value[0].id
    }
  } finally {
    carregandoEventos.value = false
  }
})

watch(eventoSelecionadoId, async (novoId) => {
  if (!novoId) return
  await carregarDadosEvento(novoId)
})

async function carregarDadosEvento(id: string) {
  apiKeyAtual.value = null
  sucessoCsv.value = ''
  erroCsv.value = ''
  try {
    const info = await buscarInfo(id)
    apiKeyAtual.value = info.apiKeyCronometragem
  } catch (e) {
    console.error(e)
  }

  await carregarResultados(id)
}

async function onGerarApiKey() {
  if (!eventoSelecionadoId.value) return
  gerandoKey.value = true
  try {
    const res = await gerarApiKey(eventoSelecionadoId.value)
    apiKeyAtual.value = res.apiKeyCronometragem
  } catch (e: any) {
    alert(e.data?.message || 'Erro ao gerar chave de API.')
  } finally {
    gerandoKey.value = false
  }
}

function copiarTexto(texto: string, tipo: 'key' | 'url') {
  navigator.clipboard.writeText(texto)
  if (tipo === 'key') {
    copiadoKey.value = true
    setTimeout(() => (copiadoKey.value = false), 2000)
  } else {
    copiadoUrl.value = true
    setTimeout(() => (copiadoUrl.value = false), 2000)
  }
}

function baixarModeloCsv() {
  const modelo = `numeroPeito,tempoLiquidoSegundos,tempoBrutoSegundos,status
101,1425,1430,FINALIZADO
102,1510,1520,FINALIZADO
103,0,0,DNF
104,1640,1650,FINALIZADO`

  const blob = new Blob([modelo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo_cronometragem.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function processarArquivoUpload(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]
  const reader = new FileReader()
  reader.onload = (event) => {
    conteudoCsv.value = (event.target?.result as string) || ''
  }
  reader.readAsText(file)
}

async function submeterCsv() {
  if (!eventoSelecionadoId.value || !conteudoCsv.value.trim()) return
  processandoCsv.value = true
  erroCsv.value = ''
  sucessoCsv.value = ''

  try {
    const linhas = conteudoCsv.value.trim().split('\n')
    const resultadosParsed: Array<{
      numeroPeito: string
      tempoLiquidoSegundos: number
      tempoBrutoSegundos?: number
      status?: string
    }> = []

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i].trim()
      if (!linha) continue
      const partes = linha.split(/[,;\t]/)

      // Ignora o cabeçalho se houver
      if (i === 0 && partes[0].toLowerCase().includes('numero')) continue

      if (partes.length >= 2) {
        const numPeito = partes[0].trim()
        const tempoLiq = parseInt(partes[1].trim(), 10) || 0
        const tempoBruto = partes[2] ? parseInt(partes[2].trim(), 10) || tempoLiq : tempoLiq
        const st = partes[3] ? partes[3].trim() : 'FINALIZADO'

        if (numPeito) {
          resultadosParsed.push({
            numeroPeito: numPeito,
            tempoLiquidoSegundos: tempoLiq,
            tempoBrutoSegundos: tempoBruto,
            status: st
          })
        }
      }
    }

    if (resultadosParsed.length === 0) {
      erroCsv.value = 'Nenhum dado válido encontrado no texto/arquivo fornecido.'
      return
    }

    const res = await importarCsv(eventoSelecionadoId.value, resultadosParsed)
    sucessoCsv.value = `Sucesso! ${res.processadosComSucesso} atletas de ${res.totalRecebidos} enviados foram atualizados.`
    conteudoCsv.value = ''
    await carregarResultados(eventoSelecionadoId.value)
    abaAtiva.value = 'resultados'
  } catch (e: any) {
    erroCsv.value = e.data?.message || 'Erro ao processar arquivo de resultados.'
  } finally {
    processandoCsv.value = false
  }
}

async function carregarResultados(id: string) {
  carregandoResultados.value = true
  try {
    listaResultados.value = await listarResultados(id)
  } catch (e) {
    console.error(e)
  } finally {
    carregandoResultados.value = false
  }
}

function formatarTempo(segundos?: number | null) {
  if (!segundos && segundos !== 0) return '--:--'
  const horas = Math.floor(segundos / 3600)
  const min = Math.floor((segundos % 3600) / 60)
  const seg = segundos % 60

  const pMin = min.toString().padStart(2, '0')
  const pSeg = seg.toString().padStart(2, '0')

  if (horas > 0) {
    return `${horas}:${pMin}:${pSeg}`
  }
  return `${pMin}:${pSeg}`
}

const resultadosFiltrados = computed(() => {
  if (!busca.value.trim()) return listaResultados.value
  const q = busca.value.toLowerCase().trim()
  return listaResultados.value.filter((item) => {
    const nome = item.cliente.pf?.nomeCompleto?.toLowerCase() || ''
    const num = item.numeroPeito?.toString() || ''
    const cat = item.categoria.nome.toLowerCase()
    return nome.includes(q) || num.includes(q) || cat.includes(q)
  })
})
</script>

<template>
  <div class="space-y-6 max-w-6xl mx-auto">
    <!-- Cabeçalho -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>⏱️</span> Cronometragem & Resultados
        </h1>
        <p class="text-slate-500 text-sm mt-1">
          Gerencie a integração de chips ao vivo ou importe planilhas de resultados.
        </p>
      </div>

      <!-- Seletor de Evento -->
      <div v-if="!carregandoEventos && eventos.length > 0" class="min-w-[260px]">
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Selecione o Evento:</label>
        <select
          v-model="eventoSelecionadoId"
          class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-xs focus:border-primary focus:outline-hidden"
        >
          <option v-for="ev in eventos" :key="ev.id" :value="ev.id">
            {{ ev.nome }} ({{ ev.cidade }}/{{ ev.estado }})
          </option>
        </select>
      </div>
    </div>

    <!-- Alerta caso não haja eventos -->
    <div v-if="!carregandoEventos && eventos.length === 0" class="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
      <p class="font-bold">Nenhum evento cadastrado.</p>
      <p class="text-xs mt-1">Crie um evento primeiro para gerenciar a cronometragem.</p>
    </div>

    <div v-else-if="eventoSelecionadoId" class="space-y-6">
      <!-- Navegação por Abas -->
      <div class="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs">
        <button
          type="button"
          class="flex-1 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
          :class="abaAtiva === 'api' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'api'"
        >
          <Plug :size="15" /> API Ao Vivo (Webhook)
        </button>

        <button
          type="button"
          class="flex-1 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
          :class="abaAtiva === 'csv' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'csv'"
        >
          <FolderOpen :size="15" /> Importar Planilha (CSV)
        </button>

        <button
          type="button"
          class="flex-1 rounded-xl py-2.5 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
          :class="abaAtiva === 'resultados' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'resultados'"
        >
          <BarChart2 :size="15" /> Tabela de Resultados ({{ listaResultados.length }})
        </button>
      </div>

      <!-- ABA 1: API AO VIVO -->
      <div v-if="abaAtiva === 'api'" class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Key :size="18" /> Chave de API de Cronometragem (Ao Vivo)
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              Forneça essa chave para a empresa de cronometragem enviar os tempos dos chips em tempo real.
            </p>
          </div>

          <!-- Se já tiver Chave -->
          <div v-if="apiKeyAtual" class="space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Chave de API do Evento (Bearer Token):</label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  readonly
                  :value="apiKeyAtual"
                  class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-mono text-slate-800 shadow-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  class="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                  @click="copiarTexto(apiKeyAtual, 'key')"
                >
                  <span v-if="copiadoKey" class="inline-flex items-center gap-1"><Check :size="13" /> Copiado!</span>
                  <span v-else>Copiar</span>
                </button>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">URL do Webhook (Endpoint POST):</label>
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  readonly
                  :value="webhookUrl"
                  class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-mono text-slate-800 shadow-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  class="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 transition"
                  @click="copiarTexto(webhookUrl, 'url')"
                >
                  <span v-if="copiadoUrl" class="inline-flex items-center gap-1"><Check :size="13" /> Copiado!</span>
                  <span v-else>Copiar</span>
                </button>
              </div>
            </div>

            <div class="flex justify-end">
              <button
                type="button"
                :disabled="gerandoKey"
                class="text-xs font-bold text-red-600 hover:underline inline-flex items-center gap-1"
                @click="onGerarApiKey"
              >
                <RefreshCw :size="13" /> Gerar nova chave (revogar anterior)
              </button>
            </div>
          </div>

          <!-- Se ainda NÃO tiver Chave -->
          <div v-else class="text-center py-6 border-2 border-dashed border-slate-200 rounded-2xl p-6">
            <p class="text-sm font-bold text-slate-700 mb-3">Nenhuma chave de integração gerada para este evento.</p>
            <button
              type="button"
              :disabled="gerandoKey"
              class="rounded-xl bg-secondary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:brightness-95 disabled:opacity-50"
              @click="onGerarApiKey"
            >
              <span v-if="gerandoKey">Gerando...</span>
              <span v-else class="inline-flex items-center gap-1.5"><Key :size="14" /> Gerar Chave de API de Cronometragem</span>
            </button>
          </div>

          <!-- Exemplo do Payload em JSON -->
          <div class="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-slate-100 space-y-3">
            <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Instruções para o Desenvolvedor / Cronometragem:</p>
            <p class="text-xs text-slate-300">
              O software de cronometragem deve disparar requisições <code class="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">POST</code> para a URL do Webhook com o cabeçalho <code class="bg-slate-800 px-1.5 py-0.5 rounded text-amber-400">Authorization: Bearer &lt;SUA_CHAVE_API&gt;</code>:
            </p>
            <pre class="bg-slate-950 p-4 rounded-xl text-[11px] font-mono text-emerald-400 overflow-x-auto">
{
  "numeroPeito": "104",
  "tempoLiquidoSegundos": 1425,
  "tempoBrutoSegundos": 1430,
  "status": "FINALIZADO"
}</pre>
          </div>
        </div>
      </div>

      <!-- ABA 2: IMPORTAR PLANILHA CSV -->
      <div v-if="abaAtiva === 'csv'" class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FolderOpen :size="18" /> Importação de Resultados em Lote (CSV / TXT)
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                Suba o arquivo texto/CSV de tempos exportado pelo seu software de cronometragem.
              </p>
            </div>
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5"
              @click="baixarModeloCsv"
            >
              <Download :size="14" /> Modelo CSV de Exemplo
            </button>
          </div>

          <div v-if="sucessoCsv" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle :size="14" class="text-emerald-600" /> {{ sucessoCsv }}
          </div>

          <div v-if="erroCsv" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center gap-2">
            <AlertTriangle :size="14" class="text-red-600" /> {{ erroCsv }}
          </div>

          <!-- Upload por arquivo -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Selecionar arquivo CSV/TXT:</label>
            <input
              type="file"
              accept=".csv,.txt,.dat"
              class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              @change="processarArquivoUpload"
            />
          </div>

          <!-- Caixa de texto colável -->
          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Ou cole os dados do CSV diretamente aqui:</label>
            <textarea
              v-model="conteudoCsv"
              rows="6"
              placeholder="numeroPeito,tempoLiquidoSegundos,tempoBrutoSegundos,status&#10;101,1425,1430,FINALIZADO&#10;102,1510,1520,FINALIZADO"
              class="w-full rounded-2xl border border-slate-300 bg-slate-50 p-4 text-xs font-mono text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
            ></textarea>
          </div>

          <button
            type="button"
            :disabled="processandoCsv || !conteudoCsv.trim()"
            class="w-full sm:w-auto rounded-xl bg-primary px-6 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:brightness-95 disabled:opacity-50"
            @click="submeterCsv"
          >
            <span v-if="processandoCsv">Processando...</span>
            <span v-else class="inline-flex items-center gap-1.5"><Zap :size="14" /> Processar e Atualizar Resultados</span>
          </button>
        </div>
      </div>

      <!-- ABA 3: TABELA DE RESULTADOS -->
      <div v-if="abaAtiva === 'resultados'" class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 :size="18" /> Resultados do Evento
              </h2>
              <p class="text-xs text-slate-500">
                Lista de atletas finalizados com posições calculadas automaticamente.
              </p>
            </div>

            <div class="min-w-[240px]">
              <input
                v-model="busca"
                type="text"
                placeholder="Pesquisar atleta, # peito ou modalidade..."
                class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>

          <div v-if="carregandoResultados" class="py-12 text-center text-xs text-slate-400 font-bold">
            Carregando resultados...
          </div>

          <div v-else-if="resultadosFiltrados.length === 0" class="py-12 text-center text-xs text-slate-400">
            Nenhum resultado registrado até o momento.
          </div>

          <div v-else class="overflow-x-auto rounded-2xl border border-slate-200">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4">Geral</th>
                  <th class="py-3 px-4">Cat.</th>
                  <th class="py-3 px-4"># Peito</th>
                  <th class="py-3 px-4">Atleta</th>
                  <th class="py-3 px-4">Modalidade & Categoria</th>
                  <th class="py-3 px-4">Tempo Líquido</th>
                  <th class="py-3 px-4">Tempo Bruto</th>
                  <th class="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 font-medium text-slate-700">
                <tr v-for="item in resultadosFiltrados" :key="item.id" class="hover:bg-slate-50 transition">
                  <td class="py-3 px-4 font-black text-slate-900">
                    <span v-if="item.resultado?.colocacaoGeral" class="rounded-full bg-slate-900 text-white px-2 py-0.5 text-[11px]">
                      {{ item.resultado.colocacaoGeral }}º
                    </span>
                    <span v-else>--</span>
                  </td>
                  <td class="py-3 px-4 font-bold text-slate-700">
                    <span v-if="item.resultado?.colocacaoCategoria">
                      {{ item.resultado.colocacaoCategoria }}º
                    </span>
                    <span v-else>--</span>
                  </td>
                  <td class="py-3 px-4 font-mono font-bold text-primary">
                    #{{ item.numeroPeito || '--' }}
                  </td>
                  <td class="py-3 px-4 font-bold text-slate-900">
                    {{ item.cliente.pf?.nomeCompleto || 'Atleta' }}
                  </td>
                  <td class="py-3 px-4">
                    <p class="font-bold text-slate-800">{{ item.categoria.modalidade.nome }}</p>
                    <p class="text-[11px] text-slate-400">{{ item.categoria.nome }}</p>
                  </td>
                  <td class="py-3 px-4 font-black font-mono text-emerald-700 text-sm">
                    {{ formatarTempo(item.resultado?.tempoLiquidoSegundos) }}
                  </td>
                  <td class="py-3 px-4 font-mono text-slate-500">
                    {{ formatarTempo(item.resultado?.tempoBrutoSegundos) }}
                  </td>
                  <td class="py-3 px-4 font-bold">
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px]"
                      :class="item.resultado?.status === 'FINALIZADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'"
                    >
                      {{ item.resultado?.status || 'FINALIZADO' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
