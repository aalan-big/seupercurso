<script setup lang="ts">
import { CheckCircle, ArrowRight, Sparkles, Clock, RefreshCw, Download, QrCode } from 'lucide-vue-next'
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{ evento: EventoOrganizador }>()

const { uploadMidia } = useEventoOrganizador()
const { fetchMinhas, solicitacaoDoEvento } = useSolicitacaoArte()
const config = useRuntimeConfig()

const modalArteAberto = ref(false)
const carregandoSolicitacaoArte = ref(true)

onMounted(async () => {
  try {
    await fetchMinhas()
  } finally {
    carregandoSolicitacaoArte.value = false
  }
})

const solicitacaoArte = computed(() => solicitacaoDoEvento(props.evento.id))

const solicitacaoArteLabel: Record<string, string> = {
  PENDENTE_PAGAMENTO: 'Aguardando confirmação do pagamento',
  PAGO: 'Pagamento confirmado — na fila de produção',
  EM_PRODUCAO: 'Nossa equipe está criando sua arte',
  ENTREGUE: 'Arte pronta!',
  CANCELADO: 'Solicitação cancelada'
}

async function atualizarStatusArte() {
  carregandoSolicitacaoArte.value = true
  try {
    await fetchMinhas()
  } finally {
    carregandoSolicitacaoArte.value = false
  }
}

function urlArteEntregue(caminho: string | null) {
  return urlFoto(caminho, config.public.apiBase as string)
}

const erro = ref('')
const sucessoEmbed = ref('')
const enviando = ref<'banner' | 'regulamento' | null>(null)

const bannerUrl = computed(() => urlFoto(props.evento.bannerUrl, config.public.apiBase as string))
const regulamentoUrl = computed(() =>
  props.evento.regulamentoUrl?.startsWith('/uploads/')
    ? urlFoto(props.evento.regulamentoUrl, config.public.apiBase as string)
    : props.evento.regulamentoUrl
)

async function onArquivo(campo: 'banner' | 'regulamento', e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo) return

  erro.value = ''
  enviando.value = campo
  try {
    await uploadMidia(props.evento.id, campo, arquivo)
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    enviando.value = null
    input.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <p v-if="erro" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="sucessoEmbed" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-bold flex items-center gap-2">
      <CheckCircle :size="16" class="text-emerald-600" /> {{ sucessoEmbed }}
    </p>

    <div>
      <label class="mb-2 block text-sm font-semibold text-slate-700">Banner do evento</label>
      <div v-if="bannerUrl" class="mb-2 overflow-hidden rounded-xl border border-slate-200">
        <img :src="bannerUrl" alt="Banner do evento" class="h-32 w-full object-cover" />
      </div>
      <input
        type="file"
        accept="image/*"
        :disabled="enviando === 'banner'"
        class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        @change="(e) => onArquivo('banner', e)"
      />
      <p v-if="enviando === 'banner'" class="mt-1 text-xs text-slate-400">Enviando...</p>
    </div>

    <!-- Solicitar Arte do Evento (serviço pago) -->
    <div class="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-3">
      <div v-if="!carregandoSolicitacaoArte">
        <div v-if="!solicitacaoArte || solicitacaoArte.status === 'CANCELADO'" class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles :size="16" class="text-accent" /> Não sabe desenhar? A gente cria pra você!
            </label>
            <p class="text-xs text-slate-600 mt-0.5">
              Nossa equipe de design cria o banner/arte oficial do seu evento. Pagamento via PIX, direto por aqui.
            </p>
          </div>
          <button
            type="button"
            class="rounded-xl bg-accent px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:brightness-95 transition whitespace-nowrap"
            @click="modalArteAberto = true"
          >
            <Sparkles :size="14" class="inline mr-1" /> Solicitar Arte para o meu Evento
          </button>
        </div>

        <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Clock v-if="solicitacaoArte.status !== 'ENTREGUE'" :size="16" class="text-accent shrink-0" />
            <CheckCircle v-else :size="16" class="text-emerald-600 shrink-0" />
            <div>
              <p class="text-sm font-extrabold text-slate-900">{{ solicitacaoArteLabel[solicitacaoArte.status] }}</p>
              <p class="text-xs text-slate-500">Solicitação de arte do evento</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <a
              v-if="solicitacaoArte.status === 'ENTREGUE' && solicitacaoArte.arquivoEntregueUrl"
              :href="urlArteEntregue(solicitacaoArte.arquivoEntregueUrl)!"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-emerald-700 transition"
            >
              <Download :size="14" /> Baixar Arte
            </a>
            <button
              v-if="solicitacaoArte.status === 'PENDENTE_PAGAMENTO'"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-white hover:brightness-95 transition"
              @click="modalArteAberto = true"
            >
              <QrCode :size="14" /> Ver Pagamento PIX
            </button>
            <button
              v-if="solicitacaoArte.status !== 'ENTREGUE'"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              @click="atualizarStatusArte"
            >
              <RefreshCw :size="12" /> Verificar status
            </button>
          </div>
        </div>
      </div>
    </div>

    <SolicitarArteModal
      :aberto="modalArteAberto"
      :evento-id="evento.id"
      :evento-nome="evento.nome"
      :solicitacao-existente="solicitacaoArte"
      @fechar="modalArteAberto = false"
      @solicitado="atualizarStatusArte"
    />

    <p class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
      O percurso (mapa desenhado, URL externa ou imagem) agora é configurado <strong>por modalidade</strong>,
      já que cada distância tem seu próprio trajeto. Edite isso na aba "Modalidades".
    </p>

    <div>
      <label class="mb-2 block text-sm font-semibold text-slate-700">Regulamento em PDF</label>
      <div v-if="regulamentoUrl" class="mb-2">
        <a :href="regulamentoUrl" target="_blank" rel="noopener" class="text-sm font-semibold text-secondary hover:underline inline-flex items-center gap-1">
          Ver regulamento atual <ArrowRight :size="14" />
        </a>
      </div>
      <input
        type="file"
        accept="application/pdf"
        :disabled="enviando === 'regulamento'"
        class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        @change="(e) => onArquivo('regulamento', e)"
      />
      <p class="mt-1 text-xs text-slate-400">Ou informe uma URL de regulamento manualmente no campo abaixo.</p>
      <p v-if="enviando === 'regulamento'" class="mt-1 text-xs text-slate-400">Enviando...</p>
    </div>
  </div>
</template>
