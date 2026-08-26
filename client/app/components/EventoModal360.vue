<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  X,
  Calendar,
  MapPin,
  ClipboardList,
  Map,
  Package,
  FileText,
  CheckCircle,
  PartyPopper,
  Footprints,
  Printer,
  RefreshCw,
  Shirt,
  Pencil,
  Settings,
  Handshake,
  AlertTriangle,
  Maximize,
  Download
} from 'lucide-vue-next'
import type { InscricaoComEvento } from '~/composables/useInscricao'

const props = defineProps<{
  aberto: boolean
  inscricao: InscricaoComEvento | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { atualizarTamanhoCamisa, trocarCategoria, transferirInscricao } = useInscricao()

const abaAtiva = ref<'geral' | 'mapa' | 'kit' | 'regulamento'>('geral')
const zoomMapa = ref(false)

// Estado da edição de camisa
const editandoCamisa = ref(false)
const novoTamanhoCamisa = ref('M')
const salvandoCamisa = ref(false)
const erroCamisa = ref('')
const sucessoCamisa = ref('')

// Estado da troca de categoria/modalidade
const editandoCategoria = ref(false)
const novaCategoriaId = ref('')
const salvandoCategoria = ref(false)
const erroCategoria = ref('')
const sucessoCategoria = ref('')

// Estado da transferência de vaga
const mostrandoTransferencia = ref(false)
const emailDestinatario = ref('')
const enviandoTransferencia = ref(false)
const erroTransferencia = ref('')
const sucessoTransferencia = ref('')

const modalidadesDisponiveis = computed(() => {
  return props.inscricao?.categoria.modalidade.evento.modalidades || []
})

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

// Fecha ao pressionar ESC
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.aberto) {
    fechar()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
})

// Reseta o estado ao abrir
watch(
  () => props.aberto,
  (val) => {
    if (val && props.inscricao) {
      abaAtiva.value = 'geral'
      zoomMapa.value = false
      editandoCamisa.value = false
      novoTamanhoCamisa.value = props.inscricao.tamanhoCamisa || 'M'
      erroCamisa.value = ''
      sucessoCamisa.value = ''
      editandoCategoria.value = false
      novaCategoriaId.value = props.inscricao.categoria.id
      erroCategoria.value = ''
      sucessoCategoria.value = ''
      mostrandoTransferencia.value = false
      emailDestinatario.value = ''
      erroTransferencia.value = ''
      sucessoTransferencia.value = ''
    }
  }
)

watch(
  () => props.inscricao,
  (novaInsc) => {
    if (novaInsc) {
      novaCategoriaId.value = novaInsc.categoria.id
      novoTamanhoCamisa.value = novaInsc.tamanhoCamisa || 'M'
    }
  },
  { deep: true }
)

function fechar() {
  emit('close')
}

function formatarData(iso?: string | null) {
  if (!iso) return 'A definir'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatarDataHora(iso?: string | null) {
  if (!iso) return 'A definir'
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const mapaUrlFormatted = computed(() => {
  const raw = props.inscricao?.categoria.modalidade.evento.mapaPercursoUrl
  return urlFoto(raw, apiBase)
})

const bannerUrlFormatted = computed(() => {
  const raw = props.inscricao?.categoria.modalidade.evento.bannerUrl
  return urlFoto(raw, apiBase)
})

const regulamentoUrlFormatted = computed(() => {
  const raw = props.inscricao?.categoria.modalidade.evento.regulamentoUrl
  return urlFoto(raw, apiBase)
})


const regulamentoUrlEmbed = computed(() => {
  if (!regulamentoUrlFormatted.value) return null
  return `${regulamentoUrlFormatted.value}#toolbar=0&navpanes=0&view=FitH`
})

const pdfEmTelaCheia = ref(false)

// Verifica se o organizador bloqueou a alteração de camisa (envio para a gráfica)
const camisasBloqueadasPelaGrafica = computed(() => {
  const evento = props.inscricao?.categoria.modalidade.evento
  if (!evento) return false
  if (evento.camisasBloqueadas) return true
  if (evento.limiteTrocaCamisaAté) {
    return new Date(evento.limiteTrocaCamisaAté) < new Date()
  }
  return false
})

const statusInfo: Record<string, { texto: string; classe: string }> = {
  PENDENTE_PAGAMENTO: { texto: 'Aguardando Pagamento', classe: 'bg-amber-100 text-amber-800 border-amber-300' },
  CONFIRMADA: { texto: 'Inscrição Confirmada', classe: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-red-100 text-red-700 border-red-200' },
  EXPIRADA: { texto: 'Expirada', classe: 'bg-slate-100 text-slate-600 border-slate-200' }
}

const tamanhosDisponiveis = ['PP', 'P', 'M', 'G', 'GG', 'XG']

async function salvarTamanhoCamisa() {
  if (!props.inscricao) return
  erroCamisa.value = ''
  sucessoCamisa.value = ''
  salvandoCamisa.value = true
  try {
    await atualizarTamanhoCamisa(props.inscricao.id, novoTamanhoCamisa.value)
    sucessoCamisa.value = 'Tamanho da camiseta atualizado com sucesso!'
    editandoCamisa.value = false
  } catch (e) {
    erroCamisa.value = extrairErro(e)
  } finally {
    salvandoCamisa.value = false
  }
}

async function salvarTrocaCategoria() {
  if (!props.inscricao || !novaCategoriaId.value) return
  erroCategoria.value = ''
  sucessoCategoria.value = ''
  salvandoCategoria.value = true
  try {
    await trocarCategoria(props.inscricao.id, novaCategoriaId.value)
    sucessoCategoria.value = 'Modalidade / Categoria atualizada com sucesso!'
    editandoCategoria.value = false
  } catch (e) {
    erroCategoria.value = extrairErro(e)
  } finally {
    salvandoCategoria.value = false
  }
}

async function submeterTransferencia() {
  if (!props.inscricao) return
  erroTransferencia.value = ''
  sucessoTransferencia.value = ''
  if (!emailDestinatario.value.trim()) {
    erroTransferencia.value = 'Por favor, informe o e-mail do atleta de destino.'
    return
  }
  enviandoTransferencia.value = true
  try {
    await transferirInscricao(props.inscricao.id, emailDestinatario.value.trim())
    sucessoTransferencia.value = `Inscrição transferida com sucesso para ${emailDestinatario.value.trim()}!`
    setTimeout(() => {
      fechar()
    }, 2500)
  } catch (e) {
    erroTransferencia.value = extrairErro(e)
  } finally {
    enviandoTransferencia.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="aberto && inscricao"
      class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <!-- Overlay com efeito Blur -->
      <div
        class="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm transition-opacity"
        @click="fechar"
      ></div>

      <!-- Container do Modal -->
      <div
        class="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl transition-all my-auto max-h-[94vh] flex flex-col z-[101]"
      >
        <!-- Cabeçalho Visual com Banner / Gradiente -->
        <div class="relative bg-slate-900 text-white p-6 pb-5 overflow-hidden">
          <div
            v-if="bannerUrlFormatted"
            class="absolute inset-0 opacity-30 bg-cover bg-center"
            :style="{ backgroundImage: `url('${bannerUrlFormatted}')` }"
          ></div>
          <div v-else class="absolute inset-0 bg-gradient-to-r from-primary via-slate-800 to-secondary opacity-90"></div>

          <!-- Botão Fechar -->
          <button
            type="button"
            class="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60"
            @click="fechar"
          >
            <X :size="18" />
          </button>

          <div class="relative z-10 space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider backdrop-blur-xs">
                Modal 360°
              </span>
              <span
                class="rounded-full border px-2.5 py-0.5 text-xs font-bold"
                :class="statusInfo[inscricao.status]?.classe || 'bg-slate-800 text-slate-200 border-slate-600'"
              >
                {{ statusInfo[inscricao.status]?.texto || inscricao.status }}
              </span>
            </div>
            <h2 class="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
              {{ inscricao.categoria.modalidade.evento.nome }}
            </h2>
            <p class="text-xs sm:text-sm text-slate-200 flex items-center gap-2">
              <span class="flex items-center gap-1"><Calendar :size="14" /> {{ formatarDataHora(inscricao.categoria.modalidade.evento.dataInicio) }}</span>
              <span>•</span>
              <span class="flex items-center gap-1"><MapPin :size="14" /> {{ inscricao.categoria.modalidade.evento.cidade }}/{{ inscricao.categoria.modalidade.evento.estado }}</span>
            </p>
          </div>
        </div>

        <!-- Abas de Navegação Interna do Modal -->
        <div class="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 overflow-x-auto">
          <button
            type="button"
            class="flex items-center gap-1.5 border-b-2 py-3 px-3 text-xs sm:text-sm font-bold transition whitespace-nowrap"
            :class="abaAtiva === 'geral' ? 'border-secondary text-secondary' : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="abaAtiva = 'geral'"
          >
            <ClipboardList :size="16" /> Visão Geral
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 border-b-2 py-3 px-3 text-xs sm:text-sm font-bold transition whitespace-nowrap"
            :class="abaAtiva === 'mapa' ? 'border-secondary text-secondary' : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="abaAtiva = 'mapa'"
          >
            <Map :size="16" /> Mapa do Percurso
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 border-b-2 py-3 px-3 text-xs sm:text-sm font-bold transition whitespace-nowrap"
            :class="abaAtiva === 'kit' ? 'border-secondary text-secondary' : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="abaAtiva = 'kit'"
          >
            <Package :size="16" /> Retirada de Kit
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 border-b-2 py-3 px-3 text-xs sm:text-sm font-bold transition whitespace-nowrap"
            :class="abaAtiva === 'regulamento' ? 'border-secondary text-secondary' : 'border-transparent text-slate-500 hover:text-slate-700'"
            @click="abaAtiva = 'regulamento'"
          >
            <FileText :size="16" /> Regulamento
          </button>
        </div>

        <!-- Corpo do Modal (Conteúdo da Aba) -->
        <div class="p-6 overflow-y-auto flex-1 space-y-6">

          <!-- ABA 1: VISÃO GERAL -->
          <div v-if="abaAtiva === 'geral'" class="space-y-6">
            
            <!-- Alertas de erro/sucesso globais na aba -->
            <div v-if="sucessoCamisa" class="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              <CheckCircle :size="14" /> {{ sucessoCamisa }}
            </div>
            <div v-if="sucessoCategoria" class="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              <CheckCircle :size="14" /> {{ sucessoCategoria }}
            </div>
            <div v-if="sucessoTransferencia" class="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
              <PartyPopper :size="14" /> {{ sucessoTransferencia }}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- Card Número de Peito -->
              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Número de Peito</p>
                <p v-if="inscricao.numeroPeito" class="mt-1 text-3xl font-black font-mono text-primary">
                  #{{ inscricao.numeroPeito }}
                </p>
                <p v-else class="mt-2 text-xs italic text-slate-400">
                  Definido na entrega de kits
                </p>
              </div>

              <!-- Card Modalidade com Edição -->
              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center flex flex-col justify-between">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Modalidade & Distância</p>
                  <p class="mt-1 flex items-center justify-center gap-1.5 text-lg font-black text-slate-800">
                    <Footprints :size="18" /> {{ inscricao.categoria.modalidade.nome }}
                  </p>
                  <p class="text-xs font-semibold text-secondary">
                    Categoria: {{ inscricao.categoria.nome }}
                  </p>
                </div>

                <div class="mt-3 border-t border-slate-200 pt-2">
                  <div v-if="inscricao.kitEntregueEm" class="text-[11px] text-slate-400 italic">
                    Kit entregue
                  </div>
                  <div v-else-if="camisasBloqueadasPelaGrafica" class="flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200">
                    <Printer :size="12" /> Alteração encerrada
                  </div>
                  <div v-else-if="!editandoCategoria">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline"
                      @click="editandoCategoria = true"
                    >
                      <RefreshCw :size="12" /> Trocar modalidade
                    </button>
                  </div>
                </div>
              </div>

              <!-- Card Camisa com Formulário de Edição -->
              <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center flex flex-col justify-between">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Tamanho da Camisa</p>
                  <p class="mt-1 flex items-center justify-center gap-1.5 text-xl font-black text-slate-800">
                    <Shirt :size="18" /> {{ inscricao.tamanhoCamisa || 'Não informada' }}
                  </p>
                </div>

                <div class="mt-3 border-t border-slate-200 pt-2">
                  <!-- Se o kit já foi entregue ou a gráfica foi bloqueada -->
                  <div v-if="inscricao.kitEntregueEm" class="text-[11px] text-slate-400 italic">
                    Kit entregue (Tamanho final)
                  </div>
                  <div v-else-if="camisasBloqueadasPelaGrafica" class="flex items-center justify-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded p-1.5 border border-amber-200">
                    <Printer :size="12" /> Enviado para a gráfica
                  </div>
                  <!-- Se puder editar -->
                  <div v-else-if="!editandoCamisa">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline"
                      @click="editandoCamisa = true"
                    >
                      <Pencil :size="12" /> Alterar tamanho
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Painel Inline de Alteração de Camisa -->
            <div v-if="editandoCamisa" class="rounded-2xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-xs font-bold text-slate-800 uppercase tracking-wider">Escolha o novo tamanho da camisa:</p>
                <button type="button" class="text-xs font-bold text-slate-400 hover:text-slate-600" @click="editandoCamisa = false">Cancelar</button>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  v-for="tam in tamanhosDisponiveis"
                  :key="tam"
                  type="button"
                  class="rounded-xl border px-3 py-1.5 text-xs font-bold transition"
                  :class="novoTamanhoCamisa === tam ? 'bg-secondary text-white border-secondary' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                  @click="novoTamanhoCamisa = tam"
                >
                  {{ tam }}
                </button>
              </div>

              <p v-if="erroCamisa" class="text-xs text-red-600 font-bold">{{ erroCamisa }}</p>

              <button
                type="button"
                :disabled="salvandoCamisa"
                class="rounded-xl bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:brightness-95 disabled:opacity-50"
                @click="salvarTamanhoCamisa"
              >
                {{ salvandoCamisa ? 'Salvando...' : 'Confirmar Novo Tamanho' }}
              </button>
            </div>

            <!-- Painel Inline de Troca de Modalidade -->
            <div v-if="editandoCategoria" class="rounded-2xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
              <div class="flex items-center justify-between">
                <p class="text-xs font-bold text-slate-800 uppercase tracking-wider">Escolha a nova modalidade/distância:</p>
                <button type="button" class="text-xs font-bold text-slate-400 hover:text-slate-600" @click="editandoCategoria = false">Cancelar</button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <template v-for="mod in modalidadesDisponiveis" :key="mod.id">
                  <button
                    v-for="cat in mod.categorias"
                    :key="cat.id"
                    type="button"
                    class="rounded-xl border p-3 text-left transition text-xs flex flex-col justify-between"
                    :class="novaCategoriaId === cat.id ? 'bg-secondary text-white border-secondary shadow' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'"
                    @click="novaCategoriaId = cat.id"
                  >
                    <p class="flex items-center gap-1.5 font-extrabold text-sm"><Footprints :size="14" /> {{ mod.nome }} ({{ mod.distanciaKm }} km)</p>
                    <p class="mt-1 text-[11px] opacity-90">Categoria: {{ cat.nome }}</p>
                  </button>
                </template>
              </div>

              <p v-if="erroCategoria" class="text-xs text-red-600 font-bold">{{ erroCategoria }}</p>

              <button
                type="button"
                :disabled="salvandoCategoria || !novaCategoriaId"
                class="rounded-xl bg-secondary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:brightness-95 disabled:opacity-50"
                @click="salvarTrocaCategoria"
              >
                {{ salvandoCategoria ? 'Atualizando...' : 'Confirmar Troca de Modalidade' }}
              </button>
            </div>

            <!-- Painel de Ações Avançadas: Transferência de Vaga -->
            <div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h3 class="font-bold text-slate-900 text-sm flex items-center justify-between">
                <span class="flex items-center gap-1.5"><Settings :size="16" /> Gerenciar Inscrição</span>
                <span v-if="inscricao.status === 'CONFIRMADA'" class="text-xs font-semibold text-emerald-600">Vaga ativa</span>
              </h3>

              <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-bold text-slate-800">Passar vaga para outro atleta (Troca de Titularidade)</p>
                  <p class="text-xs text-slate-500">Inscrições pagas não aceitam cancelamento, mas você pode transferi-la para o e-mail de outro atleta cadastrado na plataforma.</p>
                </div>
                <button
                  type="button"
                  class="flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-900 hover:bg-indigo-100 transition self-stretch sm:self-auto text-center"
                  @click="mostrandoTransferencia = !mostrandoTransferencia"
                >
                  <Handshake :size="14" /> Transferir Vaga
                </button>
              </div>

              <!-- Formulário de Transferência por E-mail -->
              <div v-if="mostrandoTransferencia" class="mt-3 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <p class="text-xs font-bold text-indigo-900 uppercase tracking-wider">Transferir Titularidade da Inscrição</p>
                <p class="text-xs text-slate-600">
                  Informe o e-mail do atleta (que já deve possuir conta cadastrada na plataforma) que assumirá o seu ingresso nesta prova:
                </p>

                <input
                  v-model="emailDestinatario"
                  type="email"
                  placeholder="email.do.atleta@exemplo.com"
                  class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                />

                <div class="flex items-start gap-1.5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800">
                  <AlertTriangle :size="14" class="shrink-0 mt-0.5" /> <span><strong>Atenção:</strong> Após a transferência, esta vaga deixará o seu painel e passará a pertencer ao novo atleta. Esta operação não pode ser desfeita.</span>
                </div>

                <p v-if="erroTransferencia" class="text-xs text-red-600 font-bold">{{ erroTransferencia }}</p>

                <div class="flex gap-2 pt-1">
                  <button
                    type="button"
                    :disabled="enviandoTransferencia"
                    class="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-indigo-700 disabled:opacity-50"
                    @click="submeterTransferencia"
                  >
                    {{ enviandoTransferencia ? 'Transferindo...' : 'Confirmar Transferência' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                    @click="mostrandoTransferencia = false"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>

            <!-- Detalhes do Local e Data -->
            <div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 class="font-bold text-slate-900 text-sm flex items-center gap-2">
                <MapPin :size="16" /> Endereço & Local da Prova
              </h3>
              <p class="text-sm text-slate-600">
                <strong>Local:</strong> {{ inscricao.categoria.modalidade.evento.local }}
              </p>
              <p class="text-sm text-slate-600">
                <strong>Cidade / Estado:</strong> {{ inscricao.categoria.modalidade.evento.cidade }} - {{ inscricao.categoria.modalidade.evento.estado }}
              </p>
              <p v-if="inscricao.categoria.modalidade.evento.descricao" class="text-xs text-slate-500 pt-2 border-t border-slate-100">
                {{ inscricao.categoria.modalidade.evento.descricao }}
              </p>
            </div>
          </div>

          <!-- ABA 2: MAPA DO PERCURSO INTERATIVO -->
          <div v-else-if="abaAtiva === 'mapa'" class="space-y-4">
            <MapaInterativoPercurso
              :mapa-percurso-url="inscricao.categoria.modalidade.evento.mapaPercursoUrl"
              :mapa-embed-url="inscricao.categoria.modalidade.evento.mapaEmbedUrl"
              :rota-geo-json="inscricao.categoria.modalidade.evento.rotaGeoJson"
              :cidade="inscricao.categoria.modalidade.evento.cidade"
              :estado="inscricao.categoria.modalidade.evento.estado"
            />
          </div>

          <!-- ABA 3: RETIRADA DE KIT -->
          <div v-else-if="abaAtiva === 'kit'" class="space-y-4">
            <div class="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 space-y-3">
              <h3 class="font-bold text-blue-900 text-base flex items-center gap-2">
                <Package :size="18" /> Informações de Retirada do Kit
              </h3>
              
              <div v-if="inscricao.categoria.modalidade.evento.retiradaKitLocal">
                <p class="text-xs font-bold text-slate-400 uppercase">Local de Retirada</p>
                <p class="text-sm font-semibold text-slate-800 mt-0.5">
                  {{ inscricao.categoria.modalidade.evento.retiradaKitLocal }}
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase">Início da Entrega</p>
                  <p class="text-sm font-semibold text-slate-800">
                    {{ formatarData(inscricao.categoria.modalidade.evento.retiradaKitInicio) }}
                  </p>
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-400 uppercase">Término da Entrega</p>
                  <p class="text-sm font-semibold text-slate-800">
                    {{ formatarData(inscricao.categoria.modalidade.evento.retiradaKitFim) }}
                  </p>
                </div>
              </div>

              <div v-if="inscricao.kitEntregueEm" class="mt-3 flex items-center gap-1.5 rounded-xl bg-emerald-100 p-3 text-xs font-bold text-emerald-800">
                <CheckCircle :size="14" /> Kit já retirado pelo atleta em {{ formatarData(inscricao.kitEntregueEm) }}
              </div>
              <div v-else class="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-100 p-3 text-xs font-semibold text-amber-900">
                <AlertTriangle :size="14" /> Lembre-se de apresentar seu documento de identidade com foto para a retirada.
              </div>
            </div>
          </div>

          <!-- ABA 4: REGULAMENTO -->
          <div v-else-if="abaAtiva === 'regulamento'" class="space-y-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 class="font-bold text-slate-900 text-base flex items-center gap-2"><FileText :size="18" /> Regulamento Oficial do Evento</h3>
                  <p class="text-xs text-slate-500">
                    Leia o documento oficial abaixo ou abra em tela cheia para maior conforto.
                  </p>
                </div>
                <div v-if="regulamentoUrlFormatted" class="flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition"
                    @click="pdfEmTelaCheia = true"
                  >
                    <Maximize :size="14" /> Ler em Tela Cheia
                  </button>
                  <a
                    :href="regulamentoUrlFormatted"
                    target="_blank"
                    download
                    class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
                  >
                    <Download :size="14" /> Baixar PDF
                  </a>
                </div>
              </div>

              <!-- Leitor de PDF Embutido sem barra lateral comprimida -->
              <div v-if="regulamentoUrlEmbed" class="pt-2">
                <iframe
                  :src="regulamentoUrlEmbed"
                  class="w-full h-[520px] rounded-2xl border border-slate-200 shadow-inner bg-slate-100"
                  title="Leitor de Regulamento PDF"
                ></iframe>
              </div>
              <div v-else class="p-8 rounded-2xl bg-slate-50 text-xs text-slate-500 text-center">
                <FileText :size="32" class="mx-auto mb-2 text-slate-400" />
                O regulamento oficial em PDF pode ser solicitado diretamente com o organizador do evento.
              </div>
            </div>
          </div>

          <!-- Modal Overlay de Leitura em Tela Cheia -->
          <Teleport to="body">
            <div
              v-if="pdfEmTelaCheia && regulamentoUrlEmbed"
              class="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex flex-col p-4 sm:p-6"
            >
              <div class="flex items-center justify-between bg-slate-900 text-white p-4 rounded-t-2xl border-b border-slate-800">
                <div class="flex items-center gap-2">
                  <FileText :size="16" />
                  <span class="font-bold text-sm">Leitor de Regulamento PDF — {{ inscricao.categoria.modalidade.evento.nome }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <a
                    :href="regulamentoUrlFormatted!"
                    target="_blank"
                    download
                    class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition"
                  >
                    <Download :size="14" /> Baixar PDF
                  </a>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
                    @click="pdfEmTelaCheia = false"
                  >
                    <X :size="14" /> Fechar Tela Cheia
                  </button>
                </div>
              </div>
              <iframe
                :src="regulamentoUrlEmbed"
                class="w-full flex-1 rounded-b-2xl border border-slate-800 bg-white"
                title="Regulamento PDF Tela Cheia"
              ></iframe>
            </div>
          </Teleport>

        </div>

        <!-- Rodapé do Modal -->
        <div class="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
          <span class="text-xs text-slate-400">SeuPercurso Eventos Esportivos</span>
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            @click="fechar"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
