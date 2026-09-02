<script setup lang="ts">
import type { TabelaTarifas } from '../composables/useTarifas'
import type { DadosCartaoTokenizado } from '../composables/useMercadoPagoBrick'
import { ref, computed, onMounted } from 'vue'
import {
  CheckCircle,
  XCircle,
  Clock,
  Timer,
  Search,
  Loader2,
  AlertTriangle,
  Footprints,
  Calendar,
  MapPin,
  Users,
  Shirt,
  Tag,
  Package,
  Check,
  CreditCard,
  FileText,
  Handshake,
  Info,
  Medal,
  Award,
  X,
  Smartphone,
  Copy,
  RefreshCw
} from 'lucide-vue-next'
import type { InscricaoComEvento } from '~/composables/useInscricao'

const { token, user } = useAuth()
const { minhasInscricoes, fetchMinhas, cancelar, pagarInscricao } = useInscricao()

const carregando = ref(true)
const erro = ref('')
const abaAtiva = ref<'proximos' | 'historico'>('proximos')

const confirmandoId = ref<string | null>(null)
const cancelandoId = ref<string | null>(null)
const erroCancelar = ref('')

const modal360Aberto = ref(false)
const inscricaoModalId = ref<string | null>(null)

const modalPixAberto = ref(false)
const gerandoPix = ref(false)
const erroPixModal = ref('')
const pixCopiado = ref(false)
const abaPagamento = ref<'PIX' | 'CREDITO'>('PIX')
const inscricaoAtualPagamento = ref<InscricaoComEvento | null>(null)
const processandoCartao = ref(false)
const sucessoCartao = ref(false)

// Cartao tokenizado pelo Payment Brick do Mercado Pago: nenhum dado de cartao
// passa por aqui nem pelo nosso servidor.
const { montar: montarBrick, desmontar: desmontarBrick } = useMercadoPagoBrick()

const dadosPix = ref<{
  id: string
  pagamentoId?: string
  valor: string
  pixCopiaECola?: string
  pixQrCodeUrl?: string
  eventoNome: string
} | null>(null)

// Acompanhamento automatico da cobranca PIX enquanto o modal esta aberto.
const { consultarStatus } = usePagamento()
const statusPagamento = ref<'PENDENTE' | 'APROVADO' | 'EXPIRADO' | 'RECUSADO' | 'ESTORNADO' | 'CANCELADO'>('PENDENTE')
let timerStatus: ReturnType<typeof setInterval> | null = null

function pararAcompanhamento() {
  if (timerStatus) {
    clearInterval(timerStatus)
    timerStatus = null
  }
}

function acompanharPagamento(pagamentoId?: string) {
  pararAcompanhamento()
  statusPagamento.value = 'PENDENTE'
  if (!pagamentoId) return

  timerStatus = setInterval(async () => {
    try {
      const res = await consultarStatus(pagamentoId)
      if (!res) return
      statusPagamento.value = res.status
      if (res.status !== 'PENDENTE') {
        pararAcompanhamento()
        if (res.status === 'APROVADO') await fetchMinhas()
      }
    } catch {
      // Falha de rede pontual nao deve encerrar o acompanhamento.
    }
  }, 5000)
}

onBeforeUnmount(pararAcompanhamento)

const valorBasePagamento = computed(() => {
  const v = dadosPix.value?.valor || inscricaoAtualPagamento.value?.valor || 0
  return Number(v) || 0
})

// Tarifa do gateway paga pelo atleta; a tabela vem do servidor, unica fonte.
const { buscar: buscarTarifas } = useTarifas()
const tarifas = ref<TabelaTarifas | null>(null)

watch(
  () => valorBasePagamento.value,
  async (base) => {
    if (!base || base <= 0) {
      tarifas.value = null
      return
    }
    try {
      tarifas.value = await buscarTarifas(base, inscricaoAtualPagamento.value?.categoria?.modalidade?.evento?.id)
    } catch {
      tarifas.value = null
    }
  },
  { immediate: true }
)

const taxaPix = computed(() => tarifas.value?.pixTarifa ?? 0)

const opcoesParcelamentoCalculadas = computed(() => {
  const base = valorBasePagamento.value
  if (!base) return []

  const lista = []

  for (const opcao of tarifas.value?.parcelamento || []) {
    const { num: n, total: totalComJuros, parcela: valorParcela } = opcao

    if (n === 1) {
      lista.push({
        num: 1,
        total: totalComJuros,
        parcela: totalComJuros,
        label: `1x à vista de R$ ${totalComJuros.toFixed(2)}`
      })
    } else {
      lista.push({
        num: n,
        total: totalComJuros,
        parcela: valorParcela,
        label: `${n}x de R$ ${valorParcela.toFixed(2)} (Total: R$ ${totalComJuros.toFixed(2)})`
      })
    }
  }

  return lista
})

async function abrirModalPagamento(inscricao: InscricaoComEvento) {
  inscricaoAtualPagamento.value = inscricao
  erroPixModal.value = ''
  gerandoPix.value = true
  modalPixAberto.value = true
  pixCopiado.value = false
  sucessoCartao.value = false
  abaPagamento.value = 'PIX'

  const evento = inscricao.categoria?.modalidade?.evento
  if (evento?.aceitaPix === false && evento?.aceitaCartao) {
    abaPagamento.value = 'CREDITO'
  }

  // Reaproveita um PIX pendente do gateway atual. Cobranca de gateway antigo
  // nao serve: o codigo copia-e-cola ja nao e pagavel.
  const pagamentoPixValido = inscricao.pagamentos?.find(
    (p) =>
      p.metodo === 'PIX' &&
      p.status === 'PENDENTE' &&
      p.gateway === 'mercadopago' &&
      (p.pixCopiaECola || p.pixQrCodeUrl)
  )

  if (pagamentoPixValido) {
    dadosPix.value = {
      id: inscricao.id,
      pagamentoId: pagamentoPixValido.id,
      valor: String(pagamentoPixValido.valor || '0.00'),
      pixCopiaECola: pagamentoPixValido.pixCopiaECola || undefined,
      pixQrCodeUrl: pagamentoPixValido.pixQrCodeUrl || undefined,
      eventoNome: evento?.nome || 'Evento'
    }
    gerandoPix.value = false
    acompanharPagamento(pagamentoPixValido.id)
    return
  }

  await gerarNovoPix()
}

async function gerarNovoPix() {
  if (!inscricaoAtualPagamento.value) return
  gerandoPix.value = true
  erroPixModal.value = ''
  try {
    const res = await pagarInscricao(inscricaoAtualPagamento.value.id, 'PIX')
    dadosPix.value = {
      id: inscricaoAtualPagamento.value.id,
      pagamentoId: res.id,
      valor: String(res.valor || '0.00'),
      pixCopiaECola: res.pixCopiaECola,
      pixQrCodeUrl: res.pixQrCodeUrl,
      eventoNome: inscricaoAtualPagamento.value.categoria?.modalidade?.evento?.nome || 'Evento'
    }
    acompanharPagamento(res.id)
  } catch (e) {
    erroPixModal.value = extrairErro(e)
  } finally {
    gerandoPix.value = false
  }
}

async function processarPagamentoCartao(dados: DadosCartaoTokenizado) {
  if (!inscricaoAtualPagamento.value) return

  erroPixModal.value = ''
  processandoCartao.value = true

  try {
    await pagarInscricao(inscricaoAtualPagamento.value.id, 'CREDITO', dados)
    sucessoCartao.value = true
    await fetchMinhas()
    setTimeout(() => {
      pararAcompanhamento()
      modalPixAberto.value = false
      sucessoCartao.value = false
    }, 2000)
  } catch (e) {
    erroPixModal.value = extrairErro(e)
  } finally {
    processandoCartao.value = false
  }
}

// O Brick so existe enquanto a aba de cartao esta aberta no modal.
watch(
  [modalPixAberto, abaPagamento, valorBasePagamento],
  async ([aberto, aba, base]) => {
    const total = tarifas.value?.parcelamento?.[0]?.total ?? base

    if (!aberto || aba !== 'CREDITO' || !total) {
      await desmontarBrick()
      return
    }

    await nextTick()
    await montarBrick({
      container: '#brick-cartao-modal',
      valor: total,
      email: user.value?.email,
      maxParcelas: tarifas.value?.maxParcelas ?? 12,
      onPagar: (dados) => processarPagamentoCartao(dados),
      onErro: (mensagem) => {
        erroPixModal.value = mensagem
      }
    })
  }
)

function fecharModalPagamento() {
  pararAcompanhamento()
  desmontarBrick()
  modalPixAberto.value = false
}

function onTeclaModal(e: KeyboardEvent) {
  if (e.key === 'Escape' && modalPixAberto.value) fecharModalPagamento()
}

onMounted(() => window.addEventListener('keydown', onTeclaModal))
onBeforeUnmount(() => window.removeEventListener('keydown', onTeclaModal))

function copiarPix() {
  if (dadosPix.value?.pixCopiaECola) {
    navigator.clipboard.writeText(dadosPix.value.pixCopiaECola)
    pixCopiado.value = true
    setTimeout(() => { pixCopiado.value = false }, 3000)
  }
}

const inscricaoModal = computed(() => {
  if (!inscricaoModalId.value) return null
  return minhasInscricoes.value.find((i) => i.id === inscricaoModalId.value) || null
})

function abrirModal360(inscricao: InscricaoComEvento) {
  inscricaoModalId.value = inscricao.id
  modal360Aberto.value = true
}

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login?redirect=/meus-eventos')
    return
  }
  try {
    await fetchMinhas()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

function formatarData(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatarDataExtensa(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatarTempo(segundos?: number | null) {
  if (!segundos) return '--:--:--'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Filtra inscrições em 'Próximos / Recentes' vs 'Histórico / Concluídos'
const eventosProximos = computed(() => {
  const agora = new Date()
  return minhasInscricoes.value.filter((i) => {
    if (i.status === 'CANCELADA' || i.status === 'EXPIRADA') return false
    const dataFim = i.categoria.modalidade.evento.dataFim ? new Date(i.categoria.modalidade.evento.dataFim) : null
    // Se a data de término for no futuro ou hoje/ontem
    if (dataFim) {
      const umDiaDepois = new Date(dataFim.getTime() + 24 * 60 * 60 * 1000)
      return umDiaDepois >= agora
    }
    return true
  })
})

const eventosHistorico = computed(() => {
  const agora = new Date()
  return minhasInscricoes.value.filter((i) => {
    if (i.status === 'CANCELADA' || i.status === 'EXPIRADA') return true
    const dataFim = i.categoria.modalidade.evento.dataFim ? new Date(i.categoria.modalidade.evento.dataFim) : null
    if (dataFim) {
      const umDiaDepois = new Date(dataFim.getTime() + 24 * 60 * 60 * 1000)
      return umDiaDepois < agora
    }
    return false
  })
})

const statusInfo: Record<string, { texto: string; classe: string; icone: typeof Clock }> = {
  PENDENTE_PAGAMENTO: { texto: 'Aguardando Pagamento', classe: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold', icone: Clock },
  CONFIRMADA: { texto: 'Inscrição Confirmada', classe: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold', icone: CheckCircle },
  CANCELADA: { texto: 'Inscrição Cancelada', classe: 'bg-red-100 text-red-800 border-red-200 font-extrabold', icone: XCircle },
  EXPIRADA: { texto: 'Inscrição Expirada', classe: 'bg-slate-100 text-slate-600 border-slate-200 font-bold', icone: Clock }
}

async function confirmarCancelamento(id: string) {
  erroCancelar.value = ''
  cancelandoId.value = id
  try {
    await cancelar(id)
    confirmandoId.value = null
  } catch (e) {
    erroCancelar.value = extrairErro(e)
  } finally {
    cancelandoId.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
    <div class="mx-auto max-w-4xl">
      <!-- Cabeçalho -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 class="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900">
            Meus <span class="text-amber-500">Eventos</span>
          </h1>
          <p class="mt-1 text-xs text-slate-500">
            Gerencie suas inscrições recentes, consulte a retirada de kits e veja seu histórico de provas.
          </p>
        </div>
        <NuxtLink
          to="/#eventos"
          class="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-sm transition hover:bg-amber-400 self-start sm:self-auto"
        >
          <Search :size="14" /> Explorar Provas
        </NuxtLink>
      </div>

      <!-- Abas de Navegação -->
      <div class="mt-6 flex border-b border-slate-200 gap-2">
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition rounded-t-2xl"
          :class="
            abaAtiva === 'proximos'
              ? 'border-amber-500 text-amber-950 bg-amber-50/60 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          "
          @click="abaAtiva = 'proximos'"
        >
          Próximos & Recentes
          <span
            class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-black"
            :class="abaAtiva === 'proximos' ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-600'"
          >
            {{ eventosProximos.length }}
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition rounded-t-2xl"
          :class="
            abaAtiva === 'historico'
              ? 'border-amber-500 text-amber-950 bg-amber-50/60 font-black'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          "
          @click="abaAtiva = 'historico'"
        >
          Histórico & Concluídos
          <span
            class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-black"
            :class="abaAtiva === 'historico' ? 'bg-amber-200 text-amber-950' : 'bg-slate-200 text-slate-600'"
          >
            {{ eventosHistorico.length }}
          </span>
        </button>
      </div>

      <!-- Estado de Carregamento -->
      <div v-if="carregando" class="mt-12 text-center py-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
        <Loader2 :size="32" class="mx-auto animate-spin text-amber-500" />
        <p class="mt-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Carregando suas inscrições...</p>
      </div>

      <!-- Mensagem de Erro -->
      <div v-else-if="erro" class="mt-6 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700 shadow-sm">
        <AlertTriangle :size="14" /> {{ erro }}
      </div>

      <!-- Conteúdo da Aba: PRÓXIMOS & RECENTES -->
      <div v-else-if="abaAtiva === 'proximos'" class="mt-6">
        <!-- Nenhum evento próximo -->
        <div
          v-if="eventosProximos.length === 0"
          class="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm"
        >
          <Footprints :size="48" class="mx-auto text-slate-300" />
          <h3 class="mt-4 text-base font-black text-slate-800">Você não possui eventos futuros ou recentes inscritos</h3>
          <p class="mt-2 text-xs text-slate-500 max-w-md mx-auto">
            Que tal escolher o seu próximo desafio? Explore as provas disponíveis e garanta sua vaga.
          </p>
          <NuxtLink
            to="/#eventos"
            class="mt-6 inline-block rounded-2xl bg-amber-500 px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow hover:bg-amber-400 transition"
          >
            Ver Calendário de Eventos
          </NuxtLink>
        </div>

        <!-- Lista de Cards Próximos -->
        <div v-else class="flex flex-col gap-6">
          <div
            v-for="inscricao in eventosProximos"
            :key="inscricao.id"
            class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <!-- Faixa Superior com Nome do Evento e Status -->
            <div class="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Evento</span>
                  <span class="text-xs text-slate-300">•</span>
                  <span class="text-xs font-semibold text-slate-500">Inscrito em {{ formatarData(inscricao.dataInscricao) }}</span>
                </div>
                <h2 class="text-lg sm:text-xl font-black tracking-tight text-slate-900 mt-0.5">
                  {{ inscricao.categoria.modalidade.evento.nome }}
                </h2>
              </div>
              <div class="flex items-center gap-2 self-start sm:self-auto">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs shadow-xs"
                  :class="statusInfo[inscricao.status]?.classe || 'bg-slate-100 text-slate-600 border-slate-200'"
                >
                  <component :is="statusInfo[inscricao.status]?.icone" :size="14" v-if="statusInfo[inscricao.status]?.icone" />
                  <span>{{ statusInfo[inscricao.status]?.texto || inscricao.status }}</span>
                </span>
              </div>
            </div>

            <!-- Corpo do Card -->
            <div class="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <!-- Coluna 1: Data, Local e Modalidade -->
              <div class="space-y-3 md:col-span-2">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div class="flex items-start gap-2.5">
                    <Calendar :size="16" class="text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Data da Prova</p>
                      <p class="font-black text-slate-800">
                        {{ formatarDataExtensa(inscricao.categoria.modalidade.evento.dataInicio) }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-start gap-2.5">
                    <MapPin :size="16" class="text-slate-500 shrink-0 mt-0.5" />
                    <div>
                      <p class="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Local</p>
                      <p class="font-black text-slate-800">
                        {{ inscricao.categoria.modalidade.evento.local }},
                        {{ inscricao.categoria.modalidade.evento.cidade }}/{{ inscricao.categoria.modalidade.evento.estado }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                  <span v-if="inscricao.atletaNome || inscricao.dependente?.nomeCompleto" class="flex items-center gap-1 rounded-xl bg-orange-100 border border-orange-200 px-3 py-1.5 text-xs font-black text-orange-950">
                    <Users :size="14" class="text-orange-600" /> Atleta: {{ inscricao.atletaNome || inscricao.dependente?.nomeCompleto }}
                  </span>
                  <span class="flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-400">
                    <Footprints :size="14" /> {{ inscricao.categoria.modalidade.nome }}
                  </span>
                  <span class="flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800">
                    <Users :size="14" /> {{ inscricao.categoria.nome }}
                  </span>
                  <span v-if="inscricao.tamanhoCamisa" class="flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800">
                    <Shirt :size="14" /> Camisa: <strong>{{ inscricao.tamanhoCamisa }}</strong>
                  </span>
                  <span v-if="inscricao.lote" class="flex items-center gap-1 rounded-xl bg-slate-100 border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800">
                    <Tag :size="14" /> Lote: {{ inscricao.lote.nome }}
                  </span>
                </div>

                <!-- Informações sobre Kit -->
                <div
                  v-if="inscricao.categoria.modalidade.evento.retiradaKitLocal"
                  class="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-3.5 text-xs text-amber-950"
                >
                  <p class="font-black flex items-center gap-1.5 text-amber-900 uppercase tracking-wider text-[11px]">
                    <Package :size="14" /> Retirada do Kit de Atleta:
                  </p>
                  <p class="mt-1 text-slate-700 font-semibold">
                    {{ inscricao.categoria.modalidade.evento.retiradaKitLocal }}
                    <span v-if="inscricao.categoria.modalidade.evento.retiradaKitInicio" class="block text-[11px] text-slate-500 font-normal">
                      ({{ formatarData(inscricao.categoria.modalidade.evento.retiradaKitInicio) }} a {{ formatarData(inscricao.categoria.modalidade.evento.retiradaKitFim) }})
                    </span>
                  </p>
                  <p v-if="inscricao.kitEntregueEm" class="mt-1.5 font-extrabold text-emerald-700 flex items-center gap-1">
                    <Check :size="14" /> Kit entregue em {{ formatarData(inscricao.kitEntregueEm) }}
                  </p>
                </div>
              </div>

              <!-- Coluna 2: Número de Peito e Ações -->
              <div class="flex flex-col justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div>
                  <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Número de Peito</p>
                  <div class="mt-1">
                    <span
                      v-if="inscricao.numeroPeito"
                      class="text-3xl font-black tracking-tight text-slate-900 font-mono"
                    >
                      #{{ inscricao.numeroPeito }}
                    </span>
                    <span v-else class="text-[11px] font-semibold italic text-slate-400">
                      Será atribuído próximo à data da prova
                    </span>
                  </div>
                </div>

                <!-- Ações específicas por status -->
                <div class="mt-4 space-y-2">
                  <div v-if="inscricao.status === 'PENDENTE' || inscricao.status === 'PENDENTE_PAGAMENTO'" class="space-y-2">
                    <p v-if="erroCancelar && confirmandoId === inscricao.id" class="mb-2 text-xs text-red-600 font-bold">
                      {{ erroCancelar }}
                    </p>

                    <div v-if="confirmandoId === inscricao.id" class="space-y-2">
                      <p class="text-xs font-semibold text-slate-600">Confirmar cancelamento?</p>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          :disabled="cancelandoId === inscricao.id"
                          class="w-full rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          @click="confirmarCancelamento(inscricao.id)"
                        >
                          {{ cancelandoId === inscricao.id ? 'Canc...' : 'Sim' }}
                        </button>
                        <button
                          type="button"
                          class="w-full rounded-xl border border-slate-300 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                          @click="confirmandoId = null"
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                    <div v-else class="space-y-2">
                      <button
                        type="button"
                        class="flex w-full items-center justify-center gap-1.5 text-center rounded-xl bg-amber-500 py-3 text-xs font-black uppercase tracking-wider text-slate-950 shadow-xs hover:bg-amber-400 transition"
                        @click="abrirModalPagamento(inscricao)"
                      >
                        <CreditCard :size="14" /> Efetuar Pagamento
                      </button>
                      <button
                        type="button"
                        class="flex w-full items-center justify-center gap-1.5 text-center rounded-xl bg-slate-900 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 transition"
                        @click="abrirModal360(inscricao)"
                      >
                        <FileText :size="14" /> Detalhes do Evento
                      </button>
                      <button
                        type="button"
                        class="w-full text-center text-xs font-bold text-red-600 hover:text-red-700 hover:underline py-1"
                        @click="confirmandoId = inscricao.id"
                      >
                        Cancelar inscrição
                      </button>
                    </div>
                  </div>

                  <div v-else-if="inscricao.status === 'CONFIRMADA'" class="space-y-2">
                    <button
                      type="button"
                      class="flex w-full items-center justify-center gap-1.5 text-center rounded-xl bg-slate-900 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-slate-800 transition"
                      @click="abrirModal360(inscricao)"
                    >
                      <FileText :size="14" /> Ver Kit & Percurso
                    </button>
                    <button
                      type="button"
                      class="flex w-full items-center justify-center gap-1.5 text-center rounded-xl border border-indigo-200 bg-indigo-50 py-2.5 text-xs font-bold uppercase tracking-wider text-indigo-900 shadow-xs hover:bg-indigo-100 transition"
                      @click="abrirModal360(inscricao)"
                    >
                      <Handshake :size="14" /> Transferir Vaga (E-mail)
                    </button>
                    <p class="flex items-center justify-center gap-1 text-[10px] text-slate-400 text-center font-medium leading-tight pt-1">
                      <Info :size="12" class="shrink-0" /> Inscrição paga não pode ser cancelada. Você pode transferi-la para o e-mail de outro atleta cadastrado.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Conteúdo da Aba: HISTÓRICO & CONCLUÍDOS -->
      <div v-else-if="abaAtiva === 'historico'" class="mt-6">
        <!-- Nenhum evento no histórico -->
        <div
          v-if="eventosHistorico.length === 0"
          class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"
        >
          <Medal :size="48" class="mx-auto text-slate-300" />
          <h3 class="mt-4 text-lg font-bold text-slate-800">Seu histórico de provas está vazio</h3>
          <p class="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Assim que você concluir provas e eventos passados, seus tempos, colocações e certificados aparecerão aqui.
          </p>
        </div>

        <!-- Lista do Histórico -->
        <div v-else class="flex flex-col gap-6">
          <div
            v-for="inscricao in eventosHistorico"
            :key="inscricao.id"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm opacity-95 transition hover:opacity-100"
          >
            <div class="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span class="text-xs font-semibold text-slate-400">Provas Concluídas</span>
                <h2 class="text-lg font-extrabold tracking-tight text-slate-800">
                  {{ inscricao.categoria.modalidade.evento.nome }}
                </h2>
              </div>
              <span
                class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold"
                :class="statusInfo[inscricao.status]?.classe || 'bg-slate-100 text-slate-600'"
              >
                {{ statusInfo[inscricao.status]?.texto || inscricao.status }}
              </span>
            </div>

            <div class="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="md:col-span-2 space-y-2">
                <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <Calendar :size="14" /> Prova realizada em {{ formatarData(inscricao.categoria.modalidade.evento.dataInicio) }}
                </p>
                <p class="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin :size="14" /> {{ inscricao.categoria.modalidade.evento.cidade }}/{{ inscricao.categoria.modalidade.evento.estado }}
                </p>
                <div class="flex gap-2 mt-2">
                  <span class="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {{ inscricao.categoria.modalidade.nome }}
                  </span>
                  <span class="rounded bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {{ inscricao.categoria.nome }}
                  </span>
                </div>

                <!-- Resultado de Performance se existir -->
                <div v-if="inscricao.resultado" class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <p class="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider"><Timer :size="14" /> Seu Resultado:</p>
                  <div class="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="rounded-lg bg-white p-2 border border-emerald-200">
                      <p class="text-slate-400">Tempo Líquido</p>
                      <p class="font-mono font-bold text-emerald-700 text-sm">
                        {{ formatarTempo(inscricao.resultado.tempoLiquidoSegundos) }}
                      </p>
                    </div>
                    <div class="rounded-lg bg-white p-2 border border-emerald-200">
                      <p class="text-slate-400">Geral</p>
                      <p class="font-bold text-slate-800 text-sm">
                        #{{ inscricao.resultado.colocacaoGeral || '-' }}
                      </p>
                    </div>
                    <div class="rounded-lg bg-white p-2 border border-emerald-200">
                      <p class="text-slate-400">Categoria</p>
                      <p class="font-bold text-slate-800 text-sm">
                        #{{ inscricao.resultado.colocacaoCategoria || '-' }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Certificado e Ações -->
              <div class="flex flex-col justify-end gap-2 border-t border-slate-100 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
                <a
                  v-if="inscricao.certificado"
                  :href="inscricao.certificado.urlPdf"
                  target="_blank"
                  class="flex w-full items-center justify-center gap-1.5 text-center rounded-xl bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-emerald-700 transition"
                >
                  <Award :size="14" /> Baixar Certificado (PDF)
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal 360 do Evento -->
      <EventoModal360
        :aberto="modal360Aberto"
        :inscricao="inscricaoModal"
        @close="modal360Aberto = false"
      />

      <!-- Modal de Pagamento (PIX e Cartão de Crédito) -->
      <!--
        overflow-y-auto + items-start: sem isso, um modal mais alto que a tela
        ficava centralizado e o cabecalho (com o X) saia para fora da area
        visivel, deixando o usuario preso sem conseguir fechar.
      -->
      <div
        v-if="modalPixAberto"
        class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/70 backdrop-blur-xs p-4 sm:items-center"
        @click.self="fecharModalPagamento"
      >
        <div class="my-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4 border border-amber-200 animate-in fade-in zoom-in-95">
          <div class="sticky -top-6 -mx-6 -mt-6 flex items-center justify-between rounded-t-3xl border-b border-slate-100 bg-white px-6 pb-3 pt-6">
            <div>
              <h3 class="flex items-center gap-2 text-base font-black text-slate-900"><CreditCard :size="18" /> Efetuar Pagamento</h3>
              <p class="text-xs font-semibold text-slate-500">{{ dadosPix?.eventoNome || inscricaoAtualPagamento?.categoria?.modalidade?.evento?.nome || 'Inscrição' }}</p>
            </div>
            <button type="button" class="text-slate-400 hover:text-slate-600 p-1" @click="fecharModalPagamento"><X :size="18" /></button>
          </div>

          <!-- Seleção de Abas PIX vs CARTÃO DE CRÉDITO -->
          <div class="flex rounded-xl bg-slate-100 p-1">
            <button
              v-if="inscricaoAtualPagamento?.categoria?.modalidade?.evento?.aceitaPix !== false"
              type="button"
              class="flex-1 rounded-lg py-2 text-xs font-black transition"
              :class="abaPagamento === 'PIX' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              @click="abaPagamento = 'PIX'"
            >
              <span class="inline-flex items-center gap-1.5"><Smartphone :size="14" /> PIX Instantâneo</span>
            </button>
            <button
              v-if="inscricaoAtualPagamento?.categoria?.modalidade?.evento?.aceitaCartao !== false"
              type="button"
              class="flex-1 rounded-lg py-2 text-xs font-black transition"
              :class="abaPagamento === 'CREDITO' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              @click="abaPagamento = 'CREDITO'"
            >
              <span class="inline-flex items-center gap-1.5"><CreditCard :size="14" /> Cartão de Crédito</span>
            </button>
          </div>

          <div v-if="erroPixModal" class="flex items-center gap-2 rounded-2xl bg-red-50 p-4 border border-red-200 text-xs font-bold text-red-700">
            <AlertTriangle :size="14" /> {{ erroPixModal }}
          </div>

          <!-- Conteúdo da Aba PIX -->
          <div v-if="abaPagamento === 'PIX'" class="space-y-4">
            <div v-if="gerandoPix" class="text-center py-8 space-y-3">
              <Loader2 :size="32" class="mx-auto animate-spin text-amber-500" />
              <p class="text-xs font-bold text-slate-600 uppercase tracking-wider">Gerando seu QR Code PIX...</p>
            </div>

            <div v-else-if="dadosPix" class="space-y-4">
              <div class="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <img v-if="dadosPix.pixQrCodeUrl" :src="dadosPix.pixQrCodeUrl" alt="QR Code PIX" class="w-44 h-44 sm:w-52 sm:h-52 rounded-xl bg-white p-2 border border-slate-200 shadow-2xs max-w-full object-contain" />
                <div v-else class="w-44 h-44 flex items-center justify-center bg-slate-100 rounded-xl text-xs text-slate-400 font-bold">
                  Gerando QR Code...
                </div>
                <p class="text-[11px] font-bold text-slate-500 mt-2">Abra o app do seu banco e escaneie o código</p>
              </div>

              <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1 text-center">
                <p class="text-[10px] text-slate-400 font-black uppercase tracking-wider">Valor a Pagar</p>
                <p class="text-2xl sm:text-3xl font-black text-emerald-600">R$ {{ Number(dadosPix.valor).toFixed(2) }}</p>
                <p v-if="taxaPix > 0" class="text-[11px] font-semibold text-slate-500">
                  Inscrição R$ {{ Number(valorBasePagamento).toFixed(2) }}
                  + taxa de processamento R$ {{ Number(taxaPix).toFixed(2) }}
                </p>
              </div>

              <div v-if="dadosPix.pixCopiaECola" class="space-y-2 text-left">
                <label class="block text-xs font-bold uppercase tracking-wider text-slate-600">PIX Copia e Cola:</label>
                <div class="flex flex-col sm:flex-row items-stretch gap-2">
                  <input
                    type="text"
                    readonly
                    :value="dadosPix.pixCopiaECola"
                    class="w-full flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono text-slate-700 truncate select-all"
                    @click="(e) => (e.target as HTMLInputElement).select()"
                  />
                  <button
                    type="button"
                    class="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-5 py-3 sm:py-2.5 text-xs font-black text-slate-950 shadow hover:bg-amber-400 active:scale-[0.98] transition shrink-0 uppercase tracking-wider"
                    @click="copiarPix"
                  >
                    <template v-if="pixCopiado"><Check :size="14" /> Copiado com Sucesso!</template>
                    <template v-else><Copy :size="14" /> Copiar Código</template>
                  </button>
                </div>

                <button
                  type="button"
                  :disabled="gerandoPix"
                  class="w-full mt-2 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  @click="gerarNovoPix"
                >
                  <RefreshCw :size="13" :class="{ 'animate-spin': gerandoPix }" />
                  <span>{{ gerandoPix ? 'Atualizando PIX...' : 'Atualizar / Gerar Novo QR Code' }}</span>
                </button>
              </div>

              <!-- Estado da cobranca, atualizado automaticamente a cada 5s -->
              <div
                v-if="statusPagamento === 'APROVADO'"
                class="flex items-center justify-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-black uppercase tracking-wider"
              >
                <CheckCircle :size="14" />
                <span>Pagamento confirmado!</span>
              </div>

              <div
                v-else-if="statusPagamento === 'EXPIRADO'"
                class="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold text-center"
              >
                Este código PIX expirou. Gere um novo QR Code acima.
              </div>

              <div
                v-else
                class="flex items-center justify-center gap-2 text-[11px] font-semibold text-slate-500"
              >
                <span class="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0"></span>
                <span>Aguardando o pagamento… a confirmação aparece aqui automaticamente.</span>
              </div>
            </div>
          </div>

          <!-- Conteúdo da Aba CARTÃO DE CRÉDITO -->
          <div v-else-if="abaPagamento === 'CREDITO'" class="space-y-4">
            <div v-if="sucessoCartao" class="text-center py-8 space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200 p-6">
              <CheckCircle :size="40" class="mx-auto text-emerald-600" />
              <h4 class="text-base font-black text-emerald-900">Pagamento Aprovado com Sucesso!</h4>
              <p class="text-xs text-emerald-700">Sua inscrição foi confirmada e os comprovantes estão disponíveis em Meus Eventos.</p>
            </div>

            <div v-else>
              <div id="brick-cartao-modal" class="min-h-[16rem]"></div>
              <p class="mt-2 text-[11px] text-slate-500">
                Seus dados de cartão vão criptografados direto para o Mercado Pago — eles
                não passam pelo SeuPercurso.
              </p>
            </div>
          </div>

          <button
            type="button"
            class="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-slate-800 transition"
            @click="fecharModalPagamento"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
