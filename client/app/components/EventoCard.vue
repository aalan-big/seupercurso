<script setup lang="ts">
import { Footprints, Calendar, MapPin, ArrowRight, Share2, Check } from 'lucide-vue-next'
import type { EventoResumo } from '../composables/useEvento'

const props = defineProps<{ evento: EventoResumo }>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

const bannerUrlFormatada = computed(() => {
  return urlFoto(props.evento.bannerUrl, apiBase)
})


function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function formatarPreco(valor: number | null) {
  if (valor === null || valor === undefined) return null
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const estaEsgotado = computed(() => props.evento.status === 'INSCRICOES_ENCERRADAS')
const estaFinalizado = computed(() => props.evento.status === 'FINALIZADO')

const copiado = ref(false)

/**
 * Compartilha o evento.
 *
 * No celular abre a folha nativa do sistema, que e onde a divulgacao de corrida
 * de fato acontece (WhatsApp, Instagram). No desktop, onde essa API quase nunca
 * existe, copiar o link e o que sobra de util.
 */
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
      // Fechar a folha de compartilhamento nao e erro: cair no copiar depois
      // disso deixaria um "Copiado" que a pessoa nao pediu.
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
  <NuxtLink
    :to="`/eventos/${props.evento.id}`"
    class="group relative block aspect-[3/4] overflow-hidden rounded-3xl bg-slate-900 shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl"
  >
    <!-- Formato cartaz: a arte preenche o card inteiro (o organizador envia em
         3:4) e as informacoes ficam sobrepostas no rodape, sobre um degradê
         escuro para o texto ler bem em qualquer arte. -->
    <img
      v-if="bannerUrlFormatada"
      :src="bannerUrlFormatada"
      :alt="props.evento.nome"
      class="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
      :class="{ 'grayscale brightness-75': estaEsgotado || estaFinalizado }"
    />
    <div
      v-else
      :class="['absolute inset-0 flex items-center justify-center bg-gradient-to-br text-white', gradientePorId(props.evento.id)]"
    >
      <Footprints :size="64" class="opacity-60" />
    </div>

    <div class="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>

    <!-- Compartilhar e o status dividem o canto: em linha, para um nunca
         cobrir o outro quando o evento esgota ou termina. -->
    <div class="absolute right-3 top-3 flex items-center gap-2">
      <!-- O card inteiro e um link; sem o .prevent o clique aqui navegaria
           para o evento em vez de compartilhar. -->
      <button
        type="button"
        @click.stop.prevent="compartilhar"
        :aria-label="`Compartilhar ${props.evento.nome}`"
        :title="copiado ? 'Link copiado!' : 'Compartilhar'"
        class="flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-sm px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider shadow-md transition hover:bg-white"
        :class="copiado ? 'text-emerald-600' : 'text-primary'"
      >
        <Check v-if="copiado" :size="14" />
        <Share2 v-else :size="14" />
        <span v-if="copiado">Copiado</span>
      </button>

      <span
        v-if="estaEsgotado"
        class="rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-md"
      >
        Esgotado
      </span>
      <span
        v-else-if="estaFinalizado"
        class="rounded-full bg-slate-800 px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-md"
      >
        Finalizado
      </span>
    </div>

    <div class="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span class="rounded-full bg-warning px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow">
          Corrida de rua
        </span>
        <span class="flex items-center gap-1 text-xs font-bold text-white/90">
          <Calendar :size="13" /> {{ formatarData(props.evento.dataInicio) }}
        </span>
      </div>

      <h3 class="text-lg font-extrabold uppercase leading-tight tracking-tight drop-shadow line-clamp-2">
        {{ props.evento.nome }}
      </h3>
      <p class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/80">
        <MapPin :size="13" /> {{ props.evento.cidade }}/{{ props.evento.estado }}
      </p>

      <div class="mt-3 flex items-end justify-between gap-3 border-t border-white/15 pt-3">
        <div class="min-w-0">
          <span
            v-if="estaEsgotado"
            class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-red-400"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span> Inscrições Esgotadas
          </span>
          <span
            v-else-if="estaFinalizado"
            class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-slate-400"></span> Evento Finalizado
          </span>
          <span
            v-else
            class="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-400"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Inscrições Abertas
          </span>

          <p
            class="mt-0.5 text-sm font-black leading-tight"
            :class="estaEsgotado ? 'text-red-400' : estaFinalizado ? 'text-slate-300' : 'text-warning'"
          >
            <template v-if="estaEsgotado">
              Inscrições Esgotadas
            </template>
            <template v-else-if="estaFinalizado">
              Evento Encerrado
            </template>
            <template v-else-if="props.evento.valorApartirDe !== null && props.evento.valorApartirDe !== undefined">
              <template v-if="props.evento.valorApartirDe === 0">
                Gratuito
              </template>
              <template v-else>
                <span class="block text-[10px] font-bold uppercase tracking-wider text-white/70">A partir de</span>
                <span class="text-base">{{ formatarPreco(props.evento.valorApartirDe) }}</span>
              </template>
            </template>
            <template v-else>
              Consulte valores
            </template>
          </p>
        </div>

        <span
          v-if="!estaEsgotado && !estaFinalizado"
          class="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-primary transition group-hover:bg-warning group-hover:text-white"
        >
          Garantir Vaga <ArrowRight :size="14" />
        </span>
        <span
          v-else
          class="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/20 px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-wide text-white transition group-hover:bg-white/30"
        >
          Ver Detalhes <ArrowRight :size="14" />
        </span>
      </div>
    </div>
  </NuxtLink>
</template>
