<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Plug,
  FolderOpen,
  BarChart2,
  Key,
  Check,
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
  Zap,
  Users,
  FileText,
  Cpu,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Clock,
  Ban,
  Info,
} from 'lucide-vue-next'
import { useEventoOrganizador } from '~/composables/useEventoOrganizador'
import {
  useCronometragem,
  type InscricaoComResultado,
  type SolicitacaoCronometragemItem,
  type ResumoChipsCronometragem,
} from '~/composables/useCronometragem'
import { useInscritosOrganizador } from '~/composables/useInscritosOrganizador'

const { eventos, fetchEventos } = useEventoOrganizador()
const {
  buscarInfo,
  gerarApiKey,
  importarCsv,
  listarResultados,
  listarSolicitacoes,
  aprovarSolicitacao,
  recusarSolicitacao,
  revogarSolicitacao,
  importarChips,
  buscarResumoChips,
} = useCronometragem()
const { exportarCsv } = useInscritosOrganizador()
const { confirmar } = useConfirmacao()

const exportandoLista = ref<'xlsx' | 'pdf' | null>(null)

async function onExportarListaLargada(formato: 'xlsx' | 'pdf') {
  if (!eventoSelecionadoId.value) return
  exportandoLista.value = formato
  try {
    await exportarCsv({ eventoId: eventoSelecionadoId.value, status: 'CONFIRMADA' }, formato)
  } finally {
    exportandoLista.value = null
  }
}

const config = useRuntimeConfig()
const apiBase = (config.public.apiBase as string) || 'http://localhost:3000'

const carregandoEventos = ref(true)
const eventoSelecionadoId = ref<string>('')
const abaAtiva = ref<'pedidos' | 'chips' | 'resultados' | 'api' | 'csv'>('pedidos')

// =========================================================================
// ESTADO: PEDIDOS DE ACESSO (SEUPERCURSO MARK)
// =========================================================================
const carregandoSolicitacoes = ref(false)
const solicitacoes = ref<SolicitacaoCronometragemItem[]>([])
const erroSolicitacao = ref('')
const sucessoSolicitacao = ref('')

const modalAprovar = ref<SolicitacaoCronometragemItem | null>(null)
const modalRecusar = ref<SolicitacaoCronometragemItem | null>(null)
const respostaRecusa = ref('')
const modalRevogar = ref<SolicitacaoCronometragemItem | null>(null)
const processandoAcao = ref(false)

const solicitacoesPendentes = computed(() =>
  solicitacoes.value.filter((s) => s.status === 'pendente')
)

// =========================================================================
// ESTADO: CHIPS RFID (PEITO -> CHIP)
// =========================================================================
const carregandoChips = ref(false)
const resumoChips = ref<ResumoChipsCronometragem | null>(null)
const conteudoChipsCsv = ref('')
const substituirChips = ref(false)
const processandoChips = ref(false)
const erroChips = ref('')
const sucessoChips = ref('')

// =========================================================================
// ESTADO: API KEY AO VIVO
// =========================================================================
const gerandoKey = ref(false)
const apiKeyAtual = ref<string | null>(null)
const copiadoKey = ref(false)
const copiadoUrl = ref(false)

// =========================================================================
// ESTADO: IMPORTAÇÃO CSV DE RESULTADOS
// =========================================================================
const conteudoCsv = ref('')
const processandoCsv = ref(false)
const erroCsv = ref('')
const sucessoCsv = ref('')

// =========================================================================
// ESTADO: TABELA DE RESULTADOS
// =========================================================================
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
  sucessoChips.value = ''
  erroChips.value = ''
  sucessoSolicitacao.value = ''
  erroSolicitacao.value = ''

  try {
    const info = await buscarInfo(id)
    apiKeyAtual.value = info.apiKeyCronometragem
  } catch (e) {
    console.error(e)
  }

  await Promise.all([
    carregarPedidos(id),
    carregarResumoChips(id),
    carregarResultados(id),
  ])
}

// -------------------------------------------------------------------------
// FUNÇÕES: PEDIDOS DE ACESSO
// -------------------------------------------------------------------------
async function carregarPedidos(id: string) {
  carregandoSolicitacoes.value = true
  erroSolicitacao.value = ''
  try {
    solicitacoes.value = await listarSolicitacoes(id)
  } catch (e: any) {
    erroSolicitacao.value = e.data?.message || 'Erro ao carregar solicitações de cronometragem.'
  } finally {
    carregandoSolicitacoes.value = false
  }
}

function abrirModalAprovar(item: SolicitacaoCronometragemItem) {
  modalAprovar.value = item
}

async function onConfirmarAprovar() {
  if (!modalAprovar.value) return
  processandoAcao.value = true
  erroSolicitacao.value = ''
  sucessoSolicitacao.value = ''
  try {
    await aprovarSolicitacao(modalAprovar.value.id)
    sucessoSolicitacao.value = `Acesso concedido com sucesso para "${modalAprovar.value.cronometradora.nome}".`
    modalAprovar.value = null
    await carregarPedidos(eventoSelecionadoId.value)
  } catch (e: any) {
    erroSolicitacao.value = e.data?.message || 'Erro ao aprovar solicitação.'
  } finally {
    processandoAcao.value = false
  }
}

function abrirModalRecusar(item: SolicitacaoCronometragemItem) {
  modalRecusar.value = item
  respostaRecusa.value = ''
}

async function onConfirmarRecusar() {
  if (!modalRecusar.value) return
  processandoAcao.value = true
  erroSolicitacao.value = ''
  sucessoSolicitacao.value = ''
  try {
    await recusarSolicitacao(modalRecusar.value.id, respostaRecusa.value.trim() || undefined)
    sucessoSolicitacao.value = `Solicitação de "${modalRecusar.value.cronometradora.nome}" recusada.`
    modalRecusar.value = null
    respostaRecusa.value = ''
    await carregarPedidos(eventoSelecionadoId.value)
  } catch (e: any) {
    erroSolicitacao.value = e.data?.message || 'Erro ao recusar solicitação.'
  } finally {
    processandoAcao.value = false
  }
}

function abrirModalRevogar(item: SolicitacaoCronometragemItem) {
  modalRevogar.value = item
}

async function onConfirmarRevogar() {
  if (!modalRevogar.value) return
  processandoAcao.value = true
  erroSolicitacao.value = ''
  sucessoSolicitacao.value = ''
  try {
    await revogarSolicitacao(modalRevogar.value.id)
    sucessoSolicitacao.value = `Acesso de "${modalRevogar.value.cronometradora.nome}" foi revogado.`
    modalRevogar.value = null
    await carregarPedidos(eventoSelecionadoId.value)
  } catch (e: any) {
    erroSolicitacao.value = e.data?.message || 'Erro ao revogar acesso.'
  } finally {
    processandoAcao.value = false
  }
}

// -------------------------------------------------------------------------
// FUNÇÕES: CHIPS RFID
// -------------------------------------------------------------------------
async function carregarResumoChips(id: string) {
  carregandoChips.value = true
  try {
    resumoChips.value = await buscarResumoChips(id)
  } catch (e) {
    console.error(e)
  } finally {
    carregandoChips.value = false
  }
}

function baixarModeloChipsCsv() {
  const modelo = `numero_peito,tag_epc
101,E28011700000020101010101
102,E28011700000020101010102
103,E28011700000020101010103
104,E28011700000020101010104`

  const blob = new Blob([modelo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modelo_chips_peito_epc.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function processarArquivoChipsUpload(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const file = target.files[0]
  const reader = new FileReader()
  reader.onload = (event) => {
    conteudoChipsCsv.value = (event.target?.result as string) || ''
  }
  reader.readAsText(file)
}

async function submeterChipsCsv() {
  if (!eventoSelecionadoId.value || !conteudoChipsCsv.value.trim()) return

  const jaCadastrados = resumoChips.value?.totalChips ?? 0
  if (substituirChips.value && jaCadastrados > 0) {
    const enviadosPelaCronometragem = resumoChips.value?.ultimoEnvioCronometragem
      ? ' Alguns podem ter sido enviados pela empresa de cronometragem pelo programa Mark.'
      : ''
    const ok = await confirmar({
      titulo: 'Substituir todos os chips?',
      mensagem: `Isso apaga os ${jaCadastrados} chips já cadastrados nesta prova e deixa só os da planilha.${enviadosPelaCronometragem}`,
      textoConfirmar: 'Substituir todos',
      perigo: true
    })
    if (!ok) return
  }

  processandoChips.value = true
  erroChips.value = ''
  sucessoChips.value = ''

  try {
    const res = await importarChips(eventoSelecionadoId.value, {
      csvContent: conteudoChipsCsv.value,
      substituir: substituirChips.value,
    })

    sucessoChips.value = `Sucesso! ${res.totalProcessados} chips foram cadastrados e ligados aos números de peito.`
    conteudoChipsCsv.value = ''
    await carregarResumoChips(eventoSelecionadoId.value)
  } catch (e: any) {
    erroChips.value = e.data?.message || 'Erro ao importar planilha de chips.'
  } finally {
    processandoChips.value = false
  }
}

// -------------------------------------------------------------------------
// FUNÇÕES: API KEY & CSV RESULTADOS
// -------------------------------------------------------------------------
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
            status: st,
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

function formatarDataHora(iso?: string | null) {
  if (!iso) return '--'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusBadgeClass(st: string) {
  switch (st) {
    case 'pendente':
      return 'bg-amber-100 text-amber-800 border-amber-300'
    case 'aprovada':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    case 'recusada':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'revogada':
      return 'bg-slate-200 text-slate-700 border-slate-300'
    case 'expirada':
      return 'bg-zinc-100 text-zinc-500 border-zinc-300'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300'
  }
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
          Aprove pedidos de acesso do aplicativo Mark, cadastre chips RFID e publique resultados.
        </p>
      </div>

      <!-- Seletor de Evento -->
      <div v-if="!carregandoEventos && eventos.length > 0" class="w-full sm:w-auto sm:min-w-[260px]">
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
      <div class="flex flex-wrap border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1">
        <button
          type="button"
          class="flex-1 min-w-[140px] rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 relative"
          :class="abaAtiva === 'pedidos' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'pedidos'"
        >
          <ShieldCheck :size="15" /> Pedidos de Acesso
          <span
            v-if="solicitacoesPendentes.length > 0"
            class="ml-1 rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-black animate-pulse"
          >
            {{ solicitacoesPendentes.length }}
          </span>
        </button>

        <button
          type="button"
          class="flex-1 min-w-[140px] rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
          :class="abaAtiva === 'chips' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'chips'"
        >
          <Cpu :size="15" /> Chips RFID (Peito → Chip)
        </button>

        <button
          type="button"
          class="flex-1 min-w-[140px] rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
          :class="abaAtiva === 'resultados' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'resultados'"
        >
          <BarChart2 :size="15" /> Resultados ({{ listaResultados.length }})
        </button>

        <button
          type="button"
          class="flex-1 min-w-[130px] rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
          :class="abaAtiva === 'api' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'api'"
        >
          <Plug :size="15" /> Webhook Ao Vivo
        </button>

        <button
          type="button"
          class="flex-1 min-w-[130px] rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
          :class="abaAtiva === 'csv' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
          @click="abaAtiva = 'csv'"
        >
          <FolderOpen :size="15" /> Importar CSV
        </button>
      </div>

      <!-- Lista de Largada pra empresa de cronometragem -->
      <div class="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users :size="16" class="text-emerald-700" /> Lista de Largada (Planilha de Inscritos)
          </h2>
          <p class="text-xs text-slate-600 mt-1">
            Gera a planilha com nome, CPF, número do peito, modalidade e categoria de todos os atletas confirmados.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            :disabled="!!exportandoLista"
            class="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1.5"
            @click="onExportarListaLargada('xlsx')"
          >
            <Download :size="14" /> {{ exportandoLista === 'xlsx' ? 'Gerando...' : 'Excel' }}
          </button>
          <button
            type="button"
            :disabled="!!exportandoLista"
            class="rounded-xl border border-emerald-600 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-700 shadow-xs hover:bg-emerald-50 transition disabled:opacity-50 whitespace-nowrap flex items-center justify-center gap-1.5"
            @click="onExportarListaLargada('pdf')"
          >
            <FileText :size="14" /> {{ exportandoLista === 'pdf' ? 'Gerando...' : 'PDF (A4)' }}
          </button>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- ABA: PEDIDOS DE ACESSO (SEUPERCURSO MARK)                          -->
      <!-- =================================================================== -->
      <div v-if="abaAtiva === 'pedidos'" class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck :size="18" class="text-primary" /> Pedidos de Acesso de Cronometradoras
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                Empresas de cronometragem que usam o programa desktop <strong>SeuPercurso Mark</strong> pedem autorização para sincronizar os atletas e passagens.
              </p>
            </div>
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5 self-start sm:self-auto"
              @click="carregarPedidos(eventoSelecionadoId)"
            >
              <RefreshCw :size="13" /> Atualizar Lista
            </button>
          </div>

          <!-- Aviso LGPD -->
          <div class="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900 flex items-start gap-3">
            <Info :size="18" class="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p class="font-bold">Termo de Conformidade com a LGPD:</p>
              <p class="mt-0.5 text-blue-800 leading-relaxed">
                Ao aprovar uma solicitação, a empresa de cronometragem receberá acesso a: <strong>nome completo, número de peito, sexo e data de nascimento</strong> dos atletas participantes para a realização da cronometragem eletrônica. Esse acesso é válido automaticamente até <strong>7 dias após a data da prova</strong>.
              </p>
            </div>
          </div>

          <!-- Mensagens de Sucesso ou Erro -->
          <div v-if="sucessoSolicitacao" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle :size="14" class="text-emerald-600" /> {{ sucessoSolicitacao }}
          </div>

          <div v-if="erroSolicitacao" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center gap-2">
            <AlertTriangle :size="14" class="text-red-600" /> {{ erroSolicitacao }}
          </div>

          <!-- Loading ou Vazio -->
          <div v-if="carregandoSolicitacoes" class="py-12 text-center text-xs text-slate-400 font-bold">
            Carregando pedidos de acesso...
          </div>

          <div v-else-if="solicitacoes.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 space-y-2">
            <p class="font-bold text-sm">Nenhum pedido de acesso registrado para este evento.</p>
            <p class="text-xs text-slate-400 max-w-md mx-auto">
              Quando a empresa de cronometragem buscar sua prova no aplicativo Mark e solicitar autorização, o pedido aparecerá aqui para você aprovar.
            </p>
          </div>

          <!-- Tabela de Solicitações -->
          <div v-else class="overflow-x-auto rounded-2xl border border-slate-200">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th class="py-3 px-4">Cronometradora</th>
                  <th class="py-3 px-4">CNPJ / Documento</th>
                  <th class="py-3 px-4">Mensagem do Pedido</th>
                  <th class="py-3 px-4">Data do Pedido</th>
                  <th class="py-3 px-4">Situação</th>
                  <th class="py-3 px-4">Válido Até</th>
                  <th class="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 font-medium text-slate-700">
                <tr v-for="sol in solicitacoes" :key="sol.id" class="hover:bg-slate-50 transition">
                  <td class="py-3.5 px-4 font-bold text-slate-900">
                    {{ sol.cronometradora.nome }}
                  </td>
                  <td class="py-3.5 px-4 font-mono text-slate-600">
                    {{ sol.cronometradora.documento || '--' }}
                  </td>
                  <td class="py-3.5 px-4 max-w-xs">
                    <p class="truncate" :title="sol.mensagem">{{ sol.mensagem }}</p>
                    <p v-if="sol.resposta" class="text-[11px] text-slate-400 mt-0.5 truncate" :title="sol.resposta">
                      Resp: {{ sol.resposta }}
                    </p>
                  </td>
                  <td class="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {{ formatarDataHora(sol.criada_em) }}
                  </td>
                  <td class="py-3.5 px-4 whitespace-nowrap">
                    <span
                      class="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border"
                      :class="statusBadgeClass(sol.status)"
                    >
                      {{ sol.status }}
                    </span>
                  </td>
                  <td class="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                    {{ sol.valida_ate ? formatarDataHora(sol.valida_ate) : '--' }}
                  </td>
                  <td class="py-3.5 px-4 text-right whitespace-nowrap">
                    <!-- Ações se Pendente -->
                    <div v-if="sol.status === 'pendente'" class="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        class="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                        @click="abrirModalAprovar(sol)"
                      >
                        Aprovar
                      </button>
                      <button
                        type="button"
                        class="rounded-xl border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition"
                        @click="abrirModalRecusar(sol)"
                      >
                        Recusar
                      </button>
                    </div>

                    <!-- Ação se Aprovada -->
                    <div v-else-if="sol.status === 'aprovada'" class="flex items-center justify-end">
                      <button
                        type="button"
                        class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition"
                        @click="abrirModalRevogar(sol)"
                      >
                        Revogar Acesso
                      </button>
                    </div>

                    <div v-else class="text-slate-400 text-xs italic">
                      Finalizado
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- ABA: CHIPS RFID (PEITO -> CHIP)                                    -->
      <!-- =================================================================== -->
      <div v-if="abaAtiva === 'chips'" class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Cpu :size="18" class="text-primary" /> Mapeamento de Chips RFID (Peito → Chip EPC)
              </h2>
              <p class="text-xs text-slate-500 mt-1">
                A empresa de cronometragem liga os chips aos números de peito pelo programa Mark e envia para cá. Se ela te passar a planilha, você também pode importar abaixo.
              </p>
            </div>
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition flex items-center gap-1.5 self-start sm:self-auto"
              @click="baixarModeloChipsCsv"
            >
              <Download :size="14" /> Baixar Modelo CSV
            </button>
          </div>

          <!-- Cards de Diagnóstico / Resumo -->
          <div v-if="resumoChips" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Inscritos Confirmados</span>
              <p class="text-2xl font-black text-slate-900 mt-1">{{ resumoChips.totalInscritos }}</p>
              <p class="text-[11px] text-slate-500 mt-0.5">Total de atletas prontos</p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Com Número de Peito</span>
              <p class="text-2xl font-black mt-1" :class="resumoChips.inscritosComPeito === resumoChips.totalInscritos && resumoChips.totalInscritos > 0 ? 'text-emerald-600' : 'text-amber-600'">
                {{ resumoChips.inscritosComPeito }} / {{ resumoChips.totalInscritos }}
              </p>
              <p class="text-[11px] text-slate-500 mt-0.5">
                {{ resumoChips.inscritosComPeito === resumoChips.totalInscritos ? 'Todos com número definido' : 'Faltam atribuir números de peito' }}
              </p>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Chips RFID Cadastrados</span>
              <p class="text-2xl font-black mt-1" :class="resumoChips.atletasSemChip === 0 && resumoChips.inscritosComPeito > 0 ? 'text-emerald-600' : 'text-blue-600'">
                {{ resumoChips.inscritosComPeito - resumoChips.atletasSemChip }} / {{ resumoChips.inscritosComPeito }}
              </p>
              <p class="text-[11px] text-slate-500 mt-0.5">
                <template v-if="resumoChips.ultimoEnvioCronometragem">
                  Último envio da cronometragem: {{ formatarDataHora(resumoChips.ultimoEnvioCronometragem.em) }}
                </template>
                <template v-else>Atletas com peito que já têm chip</template>
              </p>
            </div>
          </div>

          <!-- Alertas de Prontidão -->
          <div v-if="resumoChips">
            <div v-if="resumoChips.totalInscritos > 0 && resumoChips.inscritosComPeito < resumoChips.totalInscritos" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-800 flex items-start gap-3">
              <AlertTriangle :size="16" class="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p>Atenção: existem {{ resumoChips.totalInscritos - resumoChips.inscritosComPeito }} atleta(s) sem número de peito definido.</p>
                <p class="font-normal mt-0.5">A empresa de cronometragem só consegue baixar os inscritos no programa Mark quando todos os atletas confirmados têm número de peito. Gere a numeração na página Kits.</p>
              </div>
            </div>

            <div v-else-if="resumoChips.atletasSemChip > 0" class="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs font-bold text-blue-800 flex items-start gap-3">
              <Info :size="16" class="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p>{{ resumoChips.atletasSemChip }} atleta(s) ainda sem chip.</p>
                <p class="font-normal mt-0.5">A empresa de cronometragem já pode baixar os inscritos. Ela liga os chips no programa Mark e envia para cá antes da largada.</p>
              </div>
            </div>

            <div v-else-if="resumoChips.totalInscritos > 0 && resumoChips.atletasSemChip === 0" class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
              <CheckCircle :size="16" class="text-emerald-600" />
              Tudo pronto para a largada! Todos os atletas possuem número de peito e chip cadastrados.
            </div>
          </div>

          <!-- Mensagens de Feedback -->
          <div v-if="sucessoChips" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle :size="14" class="text-emerald-600" /> {{ sucessoChips }}
          </div>

          <div v-if="erroChips" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center gap-2">
            <AlertTriangle :size="14" class="text-red-600" /> {{ erroChips }}
          </div>

          <!-- Formulário de Importação -->
          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600">Importar Planilha Peito → Chip EPC (opcional)</h3>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-500">Selecione o arquivo CSV / TXT:</label>
              <input
                type="file"
                accept=".csv,.txt,.dat"
                class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                @change="processarArquivoChipsUpload"
              />
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-500">Ou cole os dados no formato (numero_peito, tag_epc):</label>
              <textarea
                v-model="conteudoChipsCsv"
                rows="5"
                placeholder="numero_peito,tag_epc&#10;101,E28011700000020101010101&#10;102,E28011700000020101010102"
                class="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-mono text-slate-800 focus:border-primary focus:outline-hidden"
              ></textarea>
            </div>

            <div class="flex items-center gap-2">
              <input
                id="check-substituir"
                v-model="substituirChips"
                type="checkbox"
                class="rounded border-slate-300 text-primary focus:ring-primary"
              />
              <label for="check-substituir" class="text-xs font-bold text-slate-700">
                Apagar todos os chips já cadastrados e deixar só os desta planilha
              </label>
            </div>

            <button
              type="button"
              :disabled="processandoChips || !conteudoChipsCsv.trim()"
              class="rounded-xl bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:brightness-95 disabled:opacity-50 flex items-center gap-1.5"
              @click="submeterChipsCsv"
            >
              <span v-if="processandoChips">Importando...</span>
              <span v-else class="inline-flex items-center gap-1.5"><Zap :size="14" /> Salvar Mapeamento de Chips</span>
            </button>
          </div>
        </div>
      </div>

      <!-- =================================================================== -->
      <!-- ABA: TABELA DE RESULTADOS                                          -->
      <!-- =================================================================== -->
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

            <div class="w-full sm:w-auto sm:min-w-[240px]">
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

      <!-- =================================================================== -->
      <!-- ABA: WEBHOOK AO VIVO (API KEY)                                      -->
      <!-- =================================================================== -->
      <div v-if="abaAtiva === 'api'" class="space-y-6">
        <div class="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Key :size="18" /> Chave de API de Cronometragem (Ao Vivo)
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              Forneça essa chave para a empresa de cronometragem enviar os tempos dos chips em tempo real via webhook HTTP.
            </p>
          </div>

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

      <!-- =================================================================== -->
      <!-- ABA: IMPORTAR CSV DE RESULTADOS                                    -->
      <!-- =================================================================== -->
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

          <div class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Selecionar arquivo CSV/TXT:</label>
            <input
              type="file"
              accept=".csv,.txt,.dat"
              class="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              @change="processarArquivoUpload"
            />
          </div>

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
    </div>

    <!-- =================================================================== -->
    <!-- MODAIS DE CONFIRMAÇÃO (APROVAR / RECUSAR / REVOGAR)                -->
    <!-- =================================================================== -->

    <!-- Modal Aprovar -->
    <div
      v-if="modalAprovar"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 :size="20" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Aprovar Pedido de Acesso</h3>
            <p class="text-xs text-slate-500">{{ modalAprovar.cronometradora.nome }}</p>
          </div>
        </div>

        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1">
          <p class="font-bold flex items-center gap-1.5">
            <Info :size="14" class="text-amber-700 shrink-0" /> Aviso LGPD Obrigatório:
          </p>
          <p class="text-amber-800 leading-relaxed">
            Ao aprovar este acesso, a empresa cronometradora receberá nome, número de peito, sexo e data de nascimento dos atletas participantes para a cronometragem da prova. O acesso será válido até 7 dias após o término do evento.
          </p>
        </div>

        <p class="text-xs text-slate-600">
          Tem certeza de que deseja liberar o acesso aos dados da prova para esta cronometradora?
        </p>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            :disabled="processandoAcao"
            @click="modalAprovar = null"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
            :disabled="processandoAcao"
            @click="onConfirmarAprovar"
          >
            {{ processandoAcao ? 'Aprovando...' : 'Confirmar e Liberar Acesso' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Recusar -->
    <div
      v-if="modalRecusar"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100 text-red-700">
            <XCircle :size="20" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Recusar Pedido de Acesso</h3>
            <p class="text-xs text-slate-500">{{ modalRecusar.cronometradora.nome }}</p>
          </div>
        </div>

        <p class="text-xs text-slate-600">
          A empresa de cronometragem será informada de que o pedido de acesso foi recusado.
        </p>

        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700">Motivo / Resposta (opcional):</label>
          <textarea
            v-model="respostaRecusa"
            rows="3"
            placeholder="Ex: Não reconhecemos a empresa solicitante / Já contratamos outra empresa."
            class="w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs text-slate-800 focus:bg-white focus:border-red-500 focus:outline-hidden"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            :disabled="processandoAcao"
            @click="modalRecusar = null"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50"
            :disabled="processandoAcao"
            @click="onConfirmarRecusar"
          >
            {{ processandoAcao ? 'Recusando...' : 'Confirmar Recusa' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Revogar -->
    <div
      v-if="modalRevogar"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Ban :size="20" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Revogar Acesso Concedido</h3>
            <p class="text-xs text-slate-500">{{ modalRevogar.cronometradora.nome }}</p>
          </div>
        </div>

        <p class="text-xs text-slate-600">
          Tem certeza de que deseja revogar o acesso? A empresa perderá a capacidade de baixar a lista de inscritos e de sincronizar passagens no Mark imediatamente.
        </p>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            :disabled="processandoAcao"
            @click="modalRevogar = null"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-xl bg-red-600 px-5 py-2 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-50"
            :disabled="processandoAcao"
            @click="onConfirmarRevogar"
          >
            {{ processandoAcao ? 'Revogando...' : 'Sim, Revogar Acesso' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
