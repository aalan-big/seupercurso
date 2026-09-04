<script setup lang="ts">
import { CheckCircle, Palette, Globe, ArrowRight, Watch, Download } from 'lucide-vue-next'
import type { ModalidadeOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  eventoId: string
  cidade: string
  estado: string
  modalidade: ModalidadeOrganizador
}>()

const { uploadMapaPercursoModalidade, uploadGpxModalidade, atualizarModalidade } =
  useEventoOrganizador()
const config = useRuntimeConfig()

const erro = ref('')
const sucesso = ref('')
const enviandoArquivo = ref(false)
const enviandoGpx = ref(false)
const salvandoEmbed = ref(false)
const mostrandoDesenhador = ref(false)
const mapaEmbedInput = ref(props.modalidade.mapaEmbedUrl || '')

watch(
  () => props.modalidade.mapaEmbedUrl,
  (val) => {
    mapaEmbedInput.value = val || ''
  }
)

const mapaUrl = computed(() => urlFoto(props.modalidade.mapaPercursoUrl, config.public.apiBase as string))
const gpxUrl = computed(() => urlFoto(props.modalidade.gpxUrl, config.public.apiBase as string))

async function salvarMapaEmbed() {
  erro.value = ''
  sucesso.value = ''
  salvandoEmbed.value = true
  try {
    await atualizarModalidade(props.eventoId, props.modalidade.id, {
      mapaEmbedUrl: mapaEmbedInput.value.trim() || undefined
    })
    sucesso.value = 'URL do mapa interativo salva com sucesso!'
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    salvandoEmbed.value = false
  }
}

async function salvarRotaDesenhada(rotaJson: string) {
  erro.value = ''
  sucesso.value = ''
  try {
    await atualizarModalidade(props.eventoId, props.modalidade.id, { rotaGeoJson: rotaJson })
    sucesso.value = 'Percurso desenhado salvo com sucesso!'
    mostrandoDesenhador.value = false
  } catch (err) {
    erro.value = extrairErro(err)
  }
}

async function onArquivoGpx(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo) return

  erro.value = ''
  sucesso.value = ''
  enviandoGpx.value = true
  try {
    await uploadGpxModalidade(props.eventoId, props.modalidade.id, arquivo)
    sucesso.value = 'GPX enviado! Os atletas ja podem baixar para o relogio.'
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    enviandoGpx.value = false
    input.value = ''
  }
}

async function onArquivo(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo) return

  erro.value = ''
  enviandoArquivo.value = true
  try {
    await uploadMapaPercursoModalidade(props.eventoId, props.modalidade.id, arquivo)
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    enviandoArquivo.value = false
    input.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p v-if="erro" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>
    <p v-if="sucesso" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-bold flex items-center gap-2">
      <CheckCircle :size="16" class="text-emerald-600" /> {{ sucesso }}
    </p>

    <!-- Desenhador Interno -->
    <div class="rounded-2xl border border-warning/40 bg-warning/5 p-5 space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <label class="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Palette :size="16" class="text-amber-700" /> Desenhador de Percurso Interativo
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
          <Palette :size="14" class="inline mr-1" /> {{ modalidade.rotaGeoJson ? 'Editar Rota Desenhada' : 'Criar Novo Desenho de Rota' }}
        </button>
      </div>

      <p v-if="modalidade.rotaGeoJson" class="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl p-2.5 border border-emerald-200 flex items-center gap-1.5">
        <CheckCircle :size="14" class="text-emerald-600" /> Essa modalidade ({{ modalidade.distanciaKm }} km) já tem uma rota interativa salva.
      </p>
    </div>

    <!-- URL Externa -->
    <div class="rounded-xl border border-secondary/30 bg-secondary/5 p-4 space-y-3">
      <label class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <Globe :size="15" /> URL do Mapa Interativo Externo (Google Maps, Strava, Wikiloc ou iFrame)
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
      :cidade="cidade"
      :estado="estado"
      :rota-geo-json="modalidade.rotaGeoJson"
      @fechar="mostrandoDesenhador = false"
      @salvar="salvarRotaDesenhada"
    />

    <!-- GPX para relogio -->
    <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
      <label class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
        <Watch :size="15" /> Arquivo GPX (Garmin, Polar, Coros, Suunto)
      </label>
      <p class="text-xs text-slate-500">
        O atleta baixa e carrega no relógio para seguir o traçado durante a prova.
        Exporte do Strava, Garmin Connect ou Wikiloc no formato .gpx.
      </p>

      <a
        v-if="gpxUrl"
        :href="gpxUrl"
        download
        class="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline"
      >
        <Download :size="14" /> Baixar o GPX enviado
      </a>

      <input
        type="file"
        accept=".gpx"
        :disabled="enviandoGpx"
        class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-emerald-800 hover:file:bg-emerald-200"
        @change="onArquivoGpx"
      />
      <p v-if="enviandoGpx" class="text-xs text-slate-400">Enviando...</p>
    </div>

    <!-- Mapa estático (imagem/PDF) -->
    <div>
      <label class="mb-2 block text-sm font-semibold text-slate-700">Mapa do percurso (imagem estática ou PDF)</label>
      <div v-if="mapaUrl" class="mb-2">
        <a :href="mapaUrl" target="_blank" rel="noopener" class="text-sm font-semibold text-secondary hover:underline inline-flex items-center gap-1">
          Ver mapa atual <ArrowRight :size="14" />
        </a>
      </div>
      <input
        type="file"
        accept="image/*,application/pdf"
        :disabled="enviandoArquivo"
        class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        @change="onArquivo"
      />
      <p v-if="enviandoArquivo" class="mt-1 text-xs text-slate-400">Enviando...</p>
    </div>
  </div>
</template>
