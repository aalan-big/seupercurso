<script setup lang="ts">
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{ evento: EventoOrganizador }>()

const { uploadMidia, atualizarEvento } = useEventoOrganizador()
const config = useRuntimeConfig()

const erro = ref('')
const sucessoEmbed = ref('')
const salvandoEmbed = ref(false)
const enviando = ref<'banner' | 'mapa-percurso' | 'regulamento' | null>(null)

const mostrandoDesenhador = ref(false)
const mapaEmbedInput = ref(props.evento.mapaEmbedUrl || '')

watch(
  () => props.evento.mapaEmbedUrl,
  (val) => {
    if (val) mapaEmbedInput.value = val
  }
)

async function salvarMapaEmbed() {
  erro.value = ''
  sucessoEmbed.value = ''
  salvandoEmbed.value = true
  try {
    await atualizarEvento(props.evento.id, { mapaEmbedUrl: mapaEmbedInput.value.trim() || undefined })
    sucessoEmbed.value = 'URL do mapa interativo salva com sucesso!'
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    salvandoEmbed.value = false
  }
}

async function salvarRotaDesenhada(rotaJson: string) {
  erro.value = ''
  sucessoEmbed.value = ''
  try {
    await atualizarEvento(props.evento.id, { rotaGeoJson: rotaJson })
    sucessoEmbed.value = 'Percurso desenhado salvo com sucesso no evento!'
    mostrandoDesenhador.value = false
  } catch (err) {
    erro.value = extrairErro(err)
  }
}

const bannerUrl = computed(() => urlFoto(props.evento.bannerUrl, config.public.apiBase as string))
const mapaUrl = computed(() => urlFoto(props.evento.mapaPercursoUrl, config.public.apiBase as string))
const regulamentoUrl = computed(() =>
  props.evento.regulamentoUrl?.startsWith('/uploads/')
    ? urlFoto(props.evento.regulamentoUrl, config.public.apiBase as string)
    : props.evento.regulamentoUrl
)

async function onArquivo(campo: 'banner' | 'mapa-percurso' | 'regulamento', e: Event) {
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

    <p v-if="sucessoEmbed" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-bold">
      ✅ {{ sucessoEmbed }}
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

    <!-- Campo de Mapa Interativo (Desenhador Interno) -->
    <div class="rounded-2xl border border-warning/40 bg-warning/5 p-5 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <label class="block text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <span>🎨</span> Desenhador de Percurso Interativo
          </label>
          <p class="text-xs text-slate-600 mt-0.5">
            Desenhe o trajeto clicando nas ruas, calcule os KM automaticamente e coloque marcadores de hidratação.
          </p>
        </div>

        <button
          type="button"
          class="rounded-xl bg-warning px-4 py-2.5 text-xs font-black uppercase tracking-wider text-primary shadow-xs hover:brightness-95 transition whitespace-nowrap"
          @click="mostrandoDesenhador = true"
        >
          🎨 {{ evento.rotaGeoJson ? 'Editar Rota Desenhada' : 'Criar Novo Desenho de Rota' }}
        </button>
      </div>

      <p v-if="evento.rotaGeoJson" class="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl p-2.5 border border-emerald-200">
        ✅ Este evento possui uma rota interativa salva no banco.
      </p>
    </div>

    <!-- Campo de Mapa Interativo (Google Maps / Strava / Embed) -->
    <div class="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
      <label class="block text-sm font-bold text-slate-800">
        🌐 URL do Mapa Interativo Externo (Google Maps, Strava, Wikiloc ou iFrame)
      </label>
      <p class="text-xs text-slate-500">
        Ou se preferir, cole a URL de um mapa interativo externo:
      </p>
      <div class="flex gap-2">
        <input
          v-model="mapaEmbedInput"
          type="text"
          placeholder="https://www.google.com/maps/embed?... ou https://www.strava.com/routes/..."
          class="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-800 shadow-xs focus:border-secondary focus:outline-hidden"
        />
        <button
          type="button"
          :disabled="salvandoEmbed"
          class="rounded-xl bg-secondary px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-95 disabled:opacity-50"
          @click="salvarMapaEmbed"
        >
          {{ salvandoEmbed ? 'Salvando...' : 'Salvar Mapa' }}
        </button>
      </div>
    </div>

    <DesenhadorRota
      :aberto="mostrandoDesenhador"
      :cidade="evento.cidade"
      :estado="evento.estado"
      :rota-geo-json="evento.rotaGeoJson"
      @fechar="mostrandoDesenhador = false"
      @salvar="salvarRotaDesenhada"
    />

    <div>
      <label class="mb-2 block text-sm font-semibold text-slate-700">Mapa do percurso (imagem estática ou PDF)</label>
      <div v-if="mapaUrl" class="mb-2">
        <a :href="mapaUrl" target="_blank" rel="noopener" class="text-sm font-semibold text-secondary hover:underline">
          Ver mapa atual →
        </a>
      </div>
      <input
        type="file"
        accept="image/*,application/pdf"
        :disabled="enviando === 'mapa-percurso'"
        class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        @change="(e) => onArquivo('mapa-percurso', e)"
      />
      <p v-if="enviando === 'mapa-percurso'" class="mt-1 text-xs text-slate-400">Enviando...</p>
    </div>

    <div>
      <label class="mb-2 block text-sm font-semibold text-slate-700">Regulamento em PDF</label>
      <div v-if="regulamentoUrl" class="mb-2">
        <a :href="regulamentoUrl" target="_blank" rel="noopener" class="text-sm font-semibold text-secondary hover:underline">
          Ver regulamento atual →
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
