<script setup lang="ts">
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{ evento: EventoOrganizador }>()

const { uploadMidia } = useEventoOrganizador()
const config = useRuntimeConfig()

const erro = ref('')
const enviando = ref<'banner' | 'mapa-percurso' | 'regulamento' | null>(null)

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

    <div>
      <label class="mb-2 block text-sm font-semibold text-slate-700">Mapa do percurso (imagem ou PDF)</label>
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
