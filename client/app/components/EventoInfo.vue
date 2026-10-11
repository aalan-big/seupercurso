<script setup lang="ts">
/**
 * Pagina de informacoes do evento: o que o atleta ve antes do checkout.
 *
 * Mostra so dados que a API publica ja entrega (descricao, modalidades com o
 * preco do lote atual, percurso, retirada do kit, regulamento, organizador).
 * O botao de inscricao apenas avisa a pagina, que abre o checkout de sempre.
 */
import {
  Calendar,
  MapPin,
  Footprints,
  Share2,
  Check,
  ClipboardList,
  ArrowRight,
  Timer,
  Package,
  FileText,
  Map,
  MessageCircle,
  Instagram,
  ChevronDown,
  Camera
} from 'lucide-vue-next'
import type { EventoDetalhe, LoteEvento } from '../composables/useEvento'

const props = defineProps<{
  evento: EventoDetalhe
  /** Mesmo lote que o checkout usa para cobrar. */
  loteAtivo: LoteEvento | null
}>()

const emit = defineEmits<{ (e: 'inscrever'): void }>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

const INSTAGRAM_SEU_PERCURSO = 'https://www.instagram.com/seu_percurso/'

const bannerUrl = computed(() => urlFoto(props.evento.bannerUrl, apiBase))
const regulamentoUrl = computed(() => urlFoto(props.evento.regulamentoUrl, apiBase))

// A data da prova e gravada sem hora (meia-noite UTC): sempre ler em UTC.
const dataProva = computed(() => new Date(props.evento.dataInicio))
const diaProva = computed(() =>
  dataProva.value.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'UTC' })
)
const mesProva = computed(() =>
  dataProva.value.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase()
)
const semanaProva = computed(() =>
  dataProva.value.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase()
)
const dataProvaExtenso = computed(() =>
  dataProva.value.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
)

const ROTULO_ESPORTE: Record<string, string> = {
  CORRIDA: 'Corrida de rua',
  TRAIL_RUN: 'Trail run',
  CICLISMO: 'Ciclismo / MTB',
  MOTOCROSS: 'Motocross / Enduro',
  CAMINHADA: 'Caminhada',
  TRIATHLON: 'Natação / Triathlon',
  FITNESS: 'Crossfit / Fitness',
  OUTROS: 'Esporte',
}
const rotuloEsporte = computed(
  () => ROTULO_ESPORTE[props.evento.tipoEsporte || 'CORRIDA'] ?? ROTULO_ESPORTE.CORRIDA
)

// Mesmas situacoes do card da pagina inicial.
const estaEsgotado = computed(() => props.evento.status === 'INSCRICOES_ENCERRADAS')
const estaFinalizado = computed(() => props.evento.status === 'FINALIZADO')
const vendasEmBreve = computed(() => props.evento.situacaoVendas === 'EM_BREVE' && !!props.evento.vendasAbremEm)
const vendasEncerradas = computed(() => props.evento.situacaoVendas === 'ENCERRADAS')
const inscricoesAbertas = computed(
  () => !estaEsgotado.value && !estaFinalizado.value && !vendasEmBreve.value && !vendasEncerradas.value
)

/**
 * Dias ate a prova, contando datas do calendario de Brasilia com a hora do
 * servidor. Sem horas e minutos: o evento nao tem horario de largada gravado.
 */
const diasParaProva = computed(() => {
  const agora = props.evento.agoraServidor ? new Date(props.evento.agoraServidor) : new Date()
  const hojeBrasilia = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const [a, m, d] = hojeBrasilia.split('-').map(Number)
  const hoje = Date.UTC(a!, m! - 1, d!)
  const prova = Date.UTC(
    dataProva.value.getUTCFullYear(),
    dataProva.value.getUTCMonth(),
    dataProva.value.getUTCDate()
  )
  return Math.round((prova - hoje) / 86_400_000)
})

const modalidades = computed(() => props.evento.modalidades.filter((m) => m.ativo))

function precoDa(modalidadeId: string): number | null {
  const preco = props.loteAtivo?.precos.find((p) => p.modalidadeId === modalidadeId)
  return preco ? Number(preco.valor) : null
}

function formatarPreco(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function temPercurso(mod: (typeof modalidades.value)[number]) {
  return !!(mod.rotaGeoJson || mod.mapaEmbedUrl || mod.mapaPercursoUrl || mod.gpxUrl)
}
const percursoAberto = ref<string | null>(null)

// Retirada do kit: gravada como o organizador digitou (em UTC), igual ao painel dele.
function formatarDataHoraKit(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  return `${data} às ${hora}`
}
const temRetiradaKit = computed(
  () => !!(props.evento.retiradaKitLocal || props.evento.retiradaKitInicio || props.evento.retiradaKitFim)
)

const organizadorNome = computed(() => props.evento.organizador?.nome?.trim() || '')
const organizadorWhatsapp = computed(() => props.evento.organizador?.whatsapp?.trim() || '')
const linkWhatsapp = computed(() => {
  const digitos = organizadorWhatsapp.value.replace(/\D/g, '')
  if (digitos.length < 10) return null
  const numero = digitos.length <= 11 ? `55${digitos}` : digitos
  const mensagem = `Olá! Vi a ${props.evento.nome} no Seu Percurso e tenho uma dúvida.`
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
})

function rolarParaModalidades() {
  document.getElementById('modalidades-evento')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const arteAberta = ref(false)

const copiado = ref(false)

// Igual ao card: folha nativa no celular, copiar o link no computador.
async function compartilhar() {
  const url = `${window.location.origin}/eventos/${props.evento.id}`
  if (navigator.share) {
    try {
      await navigator.share({
        title: props.evento.nome,
        text: `${props.evento.nome} — ${props.evento.cidade}/${props.evento.estado}`,
        url
      })
      return
    } catch (erro: any) {
      if (erro?.name === 'AbortError') return
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2000)
  } catch {
    // Sem permissao de area de transferencia nao ha alternativa razoavel aqui.
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Capa: cartaz do evento + dados principais -->
    <div class="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="relative aspect-[4/5] bg-slate-900 md:aspect-auto md:min-h-[420px]">
        <img
          v-if="bannerUrl"
          :src="bannerUrl"
          :alt="evento.nome"
          class="absolute inset-0 h-full w-full object-cover object-top"
          :class="{ 'grayscale brightness-75': estaEsgotado || estaFinalizado }"
        />
        <div
          v-else
          :class="['absolute inset-0 flex items-center justify-center bg-gradient-to-br text-white', gradientePorId(evento.id)]"
        >
          <Footprints :size="64" class="opacity-60" />
        </div>

        <button
          type="button"
          :aria-label="`Compartilhar ${evento.nome}`"
          :title="copiado ? 'Link copiado!' : 'Compartilhar'"
          class="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider shadow-md backdrop-blur-sm transition hover:bg-white"
          :class="copiado ? 'text-emerald-600' : 'text-primary'"
          @click="compartilhar"
        >
          <Check v-if="copiado" :size="14" />
          <Share2 v-else :size="14" />
          <span>{{ copiado ? 'Copiado' : 'Compartilhar' }}</span>
        </button>
      </div>

      <div class="flex flex-col gap-5 p-5 sm:p-8">
        <div class="flex items-start gap-4">
          <!-- Data em destaque -->
          <div class="w-[72px] shrink-0 overflow-hidden rounded-2xl bg-orange-500 text-center text-white shadow-md">
            <p class="pt-2 text-3xl font-black leading-none">{{ diaProva }}</p>
            <p class="pb-1.5 text-xs font-black tracking-wider">{{ mesProva }}</p>
            <p class="bg-orange-600 py-1 text-[10px] font-black tracking-wider">{{ semanaProva }}</p>
          </div>

          <div class="min-w-0 space-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-orange-100 border border-orange-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange-800">
                {{ rotuloEsporte }}
              </span>
              <span
                v-if="estaEsgotado"
                class="rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-800"
              >Inscrições esgotadas</span>
              <span
                v-else-if="estaFinalizado"
                class="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700"
              >Evento finalizado</span>
              <span
                v-else-if="vendasEmBreve"
                class="rounded-full bg-amber-100 border border-amber-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900"
              >Vendas em breve</span>
              <span
                v-else-if="vendasEncerradas"
                class="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-700"
              >Vendas encerradas</span>
              <span
                v-else
                class="flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800"
              >
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Inscrições abertas
              </span>
            </div>
            <h1 class="text-2xl font-black leading-tight text-slate-900 sm:text-3xl">{{ evento.nome }}</h1>
          </div>
        </div>

        <div class="space-y-2 text-sm font-semibold text-slate-600">
          <p class="flex items-center gap-2"><Calendar class="h-4 w-4 shrink-0 text-orange-500" /> {{ dataProvaExtenso }}</p>
          <p class="flex items-start gap-2"><MapPin class="mt-0.5 h-4 w-4 shrink-0 text-orange-500" /> {{ evento.local }} - {{ evento.cidade }}/{{ evento.estado }}</p>
        </div>

        <!-- Contagem regressiva: so em dias, a prova nao tem horario gravado -->
        <div
          v-if="!estaFinalizado && diasParaProva >= 0"
          class="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3"
        >
          <Timer class="h-5 w-5 shrink-0 text-orange-500" />
          <p class="text-sm font-bold text-orange-900">
            <template v-if="diasParaProva === 0">A prova é hoje!</template>
            <template v-else-if="diasParaProva === 1">A prova é amanhã!</template>
            <template v-else>Faltam <strong class="text-lg font-black tabular-nums">{{ diasParaProva }}</strong> dias para a prova</template>
          </p>
        </div>

        <div class="mt-auto flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
            @click="rolarParaModalidades"
          >
            <ClipboardList class="h-4 w-4" /> Modalidades
          </button>
          <button
            v-if="!estaEsgotado && !estaFinalizado && !vendasEncerradas"
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition hover:bg-orange-600 active:scale-[0.98]"
            @click="emit('inscrever')"
          >
            {{ vendasEmBreve ? `Vendas abrem ${formatarDataHoraCurtaBrasilia(evento.vendasAbremEm!)}` : 'Fazer inscrição' }}
            <ArrowRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Arte "Eu vou": qualquer visitante pode montar e baixar, serve de divulgacao -->
    <div
      v-if="evento.molduraEuVouUrl && !estaFinalizado"
      class="rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 shrink-0 rounded-2xl bg-warning/15 text-warning flex items-center justify-center">
          <Camera class="w-5 h-5" />
        </div>
        <div>
          <p class="text-sm font-black text-slate-900">Vai correr? Crie sua arte "Eu vou"</p>
          <p class="text-xs text-slate-600">Coloque sua foto na moldura oficial da prova e poste no Instagram.</p>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center gap-1.5 rounded-xl bg-warning px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-xs hover:brightness-95 transition"
        @click="arteAberta = true"
      >
        <Camera class="w-4 h-4" /> Criar minha arte
      </button>
    </div>

    <ArteEuVouModal
      v-if="arteAberta && evento.molduraEuVouUrl"
      :aberto="arteAberta"
      :evento-id="evento.id"
      :evento-nome="evento.nome"
      :moldura-url="evento.molduraEuVouUrl"
      @fechar="arteAberta = false"
    />

    <!-- O Evento -->
    <section v-if="evento.descricao" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 class="border-b border-slate-100 pb-3 text-lg font-black text-slate-900">O Evento</h2>
      <p class="whitespace-pre-line pt-4 text-sm leading-relaxed text-slate-600">{{ evento.descricao }}</p>
    </section>

    <!-- Modalidades -->
    <section id="modalidades-evento" class="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 class="text-lg font-black text-slate-900">Modalidades</h2>
        <span v-if="loteAtivo && inscricoesAbertas" class="text-xs font-bold text-slate-500">Valores do {{ loteAtivo.nome }}</span>
      </div>

      <p v-if="!modalidades.length" class="pt-4 text-sm text-slate-500">O organizador ainda não cadastrou as modalidades.</p>

      <div v-else class="divide-y divide-slate-100">
        <div v-for="mod in modalidades" :key="mod.id" class="py-4">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="font-black text-slate-900">
                {{ mod.nome }}
                <span v-if="mod.distanciaKm" class="ml-1 text-xs font-bold text-orange-600">{{ Number(mod.distanciaKm).toLocaleString('pt-BR') }} km</span>
              </p>
              <p v-if="mod.descricao" class="mt-0.5 text-xs text-slate-500">{{ mod.descricao }}</p>
            </div>
            <div v-if="inscricoesAbertas && precoDa(mod.id) !== null" class="shrink-0 text-right">
              <p class="text-base font-black text-slate-900">
                {{ precoDa(mod.id) === 0 ? 'Gratuito' : formatarPreco(precoDa(mod.id)!) }}
              </p>
              <p v-if="precoDa(mod.id)! > 0 && evento.comissaoPagaPeloAtleta" class="text-[10px] font-semibold text-slate-400">+ taxa de serviço</p>
            </div>
          </div>

          <button
            v-if="temPercurso(mod)"
            type="button"
            class="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700"
            @click="percursoAberto = percursoAberto === mod.id ? null : mod.id"
          >
            <Map class="h-4 w-4" /> {{ percursoAberto === mod.id ? 'Esconder percurso' : 'Ver percurso' }}
            <ChevronDown class="h-3.5 w-3.5 transition" :class="{ 'rotate-180': percursoAberto === mod.id }" />
          </button>
          <div v-if="percursoAberto === mod.id" class="mt-3">
            <MapaInterativoPercurso
              :mapa-percurso-url="mod.mapaPercursoUrl"
              :mapa-embed-url="mod.mapaEmbedUrl"
              :rota-geo-json="mod.rotaGeoJson"
              :gpx-url="mod.gpxUrl"
              :cidade="evento.cidade"
              :estado="evento.estado"
            />
          </div>
        </div>
      </div>
    </section>

    <div class="grid gap-6 md:grid-cols-2">
      <!-- Retirada do kit -->
      <section v-if="temRetiradaKit" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 class="flex items-center gap-2 text-base font-black text-slate-900"><Package class="h-5 w-5 text-orange-500" /> Retirada do kit</h2>
        <div class="mt-3 space-y-2 text-sm text-slate-600">
          <p v-if="evento.retiradaKitLocal"><strong class="text-slate-800">Local:</strong> {{ evento.retiradaKitLocal }}</p>
          <p v-if="evento.retiradaKitInicio"><strong class="text-slate-800">Início:</strong> {{ formatarDataHoraKit(evento.retiradaKitInicio) }}</p>
          <p v-if="evento.retiradaKitFim"><strong class="text-slate-800">Término:</strong> {{ formatarDataHoraKit(evento.retiradaKitFim) }}</p>
        </div>
      </section>

      <!-- Regulamento -->
      <section v-if="regulamentoUrl" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 class="flex items-center gap-2 text-base font-black text-slate-900"><FileText class="h-5 w-5 text-orange-500" /> Regulamento</h2>
        <p class="mt-2 text-sm text-slate-600">Leia as regras oficiais da prova antes de se inscrever.</p>
        <a
          :href="regulamentoUrl"
          target="_blank"
          rel="noopener"
          class="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-primary-hover"
        >
          <FileText class="h-4 w-4" /> Abrir regulamento (PDF)
        </a>
      </section>

      <!-- Organizador -->
      <section v-if="organizadorNome" class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 class="text-xs font-black uppercase tracking-wider text-slate-500">Organizador</h2>
        <div class="mt-3 flex items-center gap-3">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-500 text-lg font-black text-white">
            {{ organizadorNome.charAt(0).toUpperCase() }}
          </div>
          <p class="font-black text-slate-900">{{ organizadorNome }}</p>
        </div>
        <a
          v-if="linkWhatsapp"
          :href="linkWhatsapp"
          target="_blank"
          rel="noopener"
          class="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
        >
          <MessageCircle class="h-4 w-4" /> WhatsApp · {{ organizadorWhatsapp }}
        </a>
        <p class="mt-4 text-[11px] text-slate-400">As informações divulgadas são de responsabilidade do organizador.</p>
      </section>

      <!-- Instagram do Seu Percurso -->
      <section class="flex flex-col justify-center rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
        <h2 class="text-base font-black text-slate-900">Bora pro próximo desafio?</h2>
        <p class="mt-1 text-sm text-slate-500">Siga o Seu Percurso no Instagram e saiba primeiro das novas provas.</p>
        <a
          :href="INSTAGRAM_SEU_PERCURSO"
          target="_blank"
          rel="noopener"
          class="mx-auto mt-4 inline-flex items-center gap-2 rounded-xl bg-warning px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md transition hover:brightness-95"
        >
          <Instagram class="h-4 w-4" /> Seguir @seu_percurso
        </a>
      </section>
    </div>

    <!-- Segunda chamada para a inscricao, para quem leu tudo -->
    <div v-if="!estaEsgotado && !estaFinalizado && !vendasEncerradas" class="flex justify-center pb-4">
      <button
        type="button"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-8 py-4 text-sm font-black uppercase tracking-wider text-white shadow-md transition hover:bg-orange-600 active:scale-[0.98] sm:w-auto"
        @click="emit('inscrever')"
      >
        {{ vendasEmBreve ? `Vendas abrem ${formatarDataHoraCurtaBrasilia(evento.vendasAbremEm!)}` : 'Fazer inscrição' }}
        <ArrowRight class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
