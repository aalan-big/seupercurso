<script setup lang="ts">
import { Trash2, UserRound } from 'lucide-vue-next'
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{ evento: EventoOrganizador }>()

const { uploadMolduraEuVou, removerMolduraEuVou } = useEventoOrganizador()
const config = useRuntimeConfig()

const erro = ref('')
const sucesso = ref('')
const enviando = ref(false)
const removendo = ref(false)

const molduraUrl = computed(() => urlFoto(props.evento.molduraEuVouUrl ?? null, config.public.apiBase as string))

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem.'))
    }
    img.src = url
  })
}

/**
 * Mesmas regras do servidor (PNG 4:5) e, a mais, confere se existe de fato a
 * janela transparente onde a foto do atleta entra.
 */
async function validarMoldura(arquivo: File): Promise<string | null> {
  if (arquivo.type !== 'image/png') {
    return 'A moldura precisa ser um arquivo PNG.'
  }
  if (arquivo.size > 8 * 1024 * 1024) {
    return 'A moldura pode ter no máximo 8 MB.'
  }
  const img = await carregarImagem(arquivo)
  const largura = img.naturalWidth
  const altura = img.naturalHeight
  if (Math.abs(largura / altura - 4 / 5) > 0.02) {
    return `A moldura precisa estar na proporção 4:5 (vertical), por exemplo 1080×1350px. A imagem enviada tem ${largura}×${altura}px.`
  }
  if (largura < 800 || largura > 4000) {
    return `A moldura precisa ter entre 800 e 4000px de largura (recomendado 1080×1350px). A imagem enviada tem ${largura}×${altura}px.`
  }

  // Amostra reduzida basta para medir a área transparente.
  const canvas = document.createElement('canvas')
  canvas.width = 216
  canvas.height = 270
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let transparentes = 0
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i]! < 128) transparentes++
  }
  const fracao = transparentes / (canvas.width * canvas.height)
  if (fracao < 0.05) {
    return 'Não encontramos a janela transparente para a foto do atleta. Exporte o PNG com a área da foto transparente (sem fundo).'
  }
  if (fracao > 0.95) {
    return 'A moldura está quase toda transparente. Confira se o arquivo certo foi exportado.'
  }
  return null
}

async function onArquivo(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo) return
  erro.value = ''
  sucesso.value = ''
  try {
    const problema = await validarMoldura(arquivo)
    if (problema) {
      erro.value = problema
      return
    }
    enviando.value = true
    await uploadMolduraEuVou(props.evento.id, arquivo)
    sucesso.value = 'Moldura salva! Os atletas confirmados já podem criar a arte "Eu vou".'
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    enviando.value = false
    input.value = ''
  }
}

async function onRemover() {
  if (!confirm('Remover a moldura "Eu vou"? Os atletas deixam de ver a opção de criar a arte.')) return
  erro.value = ''
  sucesso.value = ''
  removendo.value = true
  try {
    await removerMolduraEuVou(props.evento.id)
    sucesso.value = 'Moldura removida.'
  } catch (err) {
    erro.value = extrairErro(err)
  } finally {
    removendo.value = false
  }
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 p-4 space-y-3">
    <div>
      <label class="block text-sm font-semibold text-slate-700">Moldura "Eu vou" para os atletas <span class="font-normal text-slate-400">(opcional)</span></label>
      <p class="mt-0.5 text-xs text-slate-500">
        Com a moldura enviada, cada atleta com inscrição confirmada coloca a própria foto nela e baixa a arte para postar no Instagram.
        É divulgação grátis para a sua prova.
      </p>
    </div>

    <ul class="space-y-0.5 text-xs text-slate-500">
      <li>• Arquivo <strong class="text-slate-700">PNG</strong> com a <strong class="text-slate-700">janela da foto transparente</strong> (sem fundo)</li>
      <li>• <strong class="text-slate-700">Proporção 4:5 (vertical)</strong>, tamanho recomendado 1080×1350px (formato do feed do Instagram)</li>
      <li>• Deixe uma área livre na parte de baixo da janela: o nome do atleta pode aparecer ali, se ele quiser</li>
      <li>• Máximo 8 MB</li>
    </ul>

    <p v-if="erro" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{{ sucesso }}</p>

    <div v-if="molduraUrl" class="flex flex-col sm:flex-row gap-4 sm:items-end">
      <div>
        <p class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Pré-visualização</p>
        <!-- Fundo simula a foto do atleta: aparece só onde a moldura é transparente. -->
        <div class="relative w-44 aspect-[4/5] overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-sky-300 via-slate-300 to-emerald-300">
          <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-600/70">
            <UserRound :size="56" />
            <span class="text-[10px] font-bold uppercase">Foto do atleta</span>
          </div>
          <img :src="molduraUrl" alt="Moldura Eu vou" class="absolute inset-0 h-full w-full" />
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 self-start sm:self-end rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-50"
        :disabled="removendo"
        @click="onRemover"
      >
        <Trash2 :size="13" /> {{ removendo ? 'Removendo...' : 'Remover moldura' }}
      </button>
    </div>

    <div>
      <input
        type="file"
        accept="image/png"
        :disabled="enviando"
        class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        @change="onArquivo"
      />
      <p v-if="enviando" class="mt-1 text-xs text-slate-400">Enviando...</p>
      <p v-else-if="molduraUrl" class="mt-1 text-xs text-slate-400">Enviar outro arquivo substitui a moldura atual.</p>
    </div>
  </div>
</template>
