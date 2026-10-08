<script setup lang="ts">
import { X, ImagePlus, Download, Share2, Loader2, ZoomIn } from 'lucide-vue-next'

/**
 * Arte "Eu vou": o atleta coloca a foto na moldura da prova e baixa a imagem.
 * A arte sai no formato da moldura (story 1080×1920 ou feed 1080×1350).
 * Tudo acontece no navegador (canvas): a foto nunca sai do aparelho dele.
 */
const props = defineProps<{
  aberto: boolean
  eventoId: string
  eventoNome: string
  /** Caminho salvo no evento (/uploads/...): muda quando o organizador troca a moldura. */
  molduraUrl: string
}>()

const emit = defineEmits<{ fechar: [] }>()

const config = useRuntimeConfig()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const inputFotoRef = ref<HTMLInputElement | null>(null)

const carregandoMoldura = ref(false)
const erro = ref('')
const zoom = ref(1)
const gerando = ref(false)
const podeCompartilhar = ref(false)

let moldura: HTMLImageElement | null = null
let foto: HTMLImageElement | null = null
let urlFotoLocal: string | null = null
/** Retângulo transparente da moldura (onde a foto aparece), em pixels da moldura. */
let janela = { x: 0, y: 0, w: 0, h: 0 }
/** Centro da foto no canvas; a escala base cobre a janela inteira. */
let centro = { x: 0, y: 0 }
let escalaBase = 1

const temFoto = ref(false)
/** Moldura story (9:16) é bem alta: a prévia fica mais estreita para caber na tela. */
const molduraAlta = ref(false)

function carregarImagem(src: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('imagem'))
    img.src = src
  })
}

/** Acha a caixa da área transparente lendo o alfa numa cópia reduzida da moldura. */
function medirJanela(img: HTMLImageElement) {
  const fator = 4
  const w = Math.max(1, Math.round(img.naturalWidth / fator))
  const h = Math.max(1, Math.round(img.naturalHeight / fator))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const dados = ctx.getImageData(0, 0, w, h).data
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dados[(y * w + x) * 4 + 3]! < 128) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) {
    janela = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }
    return
  }
  const escala = img.naturalWidth / w
  janela = {
    x: minX * escala,
    y: minY * escala,
    w: (maxX - minX + 1) * escala,
    h: (maxY - minY + 1) * escala
  }
}

async function abrir() {
  erro.value = ''
  zoom.value = 1
  podeCompartilhar.value = typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
  carregandoMoldura.value = true
  try {
    // Rota da API (com CORS) e não /uploads: sem CORS o canvas não deixa baixar.
    const src = `${config.public.apiBase}/eventos/${props.eventoId}/moldura-eu-vou?v=${encodeURIComponent(props.molduraUrl)}`
    moldura = await carregarImagem(src, true)
    molduraAlta.value = moldura.naturalHeight / moldura.naturalWidth > 1.5
    medirJanela(moldura)
  } catch {
    moldura = null
    erro.value = 'Não foi possível carregar a moldura desta prova. Tente de novo em instantes.'
  } finally {
    carregandoMoldura.value = false
  }
  // O canvas só existe depois que o carregamento termina.
  await nextTick()
  desenhar()
}

function limparFoto() {
  if (urlFotoLocal) URL.revokeObjectURL(urlFotoLocal)
  urlFotoLocal = null
  foto = null
  temFoto.value = false
}

watch(
  () => props.aberto,
  (aberto) => {
    if (aberto) abrir()
    else limparFoto()
  },
  { immediate: true }
)

onBeforeUnmount(limparFoto)

async function onFoto(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  input.value = ''
  if (!arquivo) return
  if (!arquivo.type.startsWith('image/')) {
    erro.value = 'Escolha uma foto (JPG ou PNG).'
    return
  }
  erro.value = ''
  limparFoto()
  urlFotoLocal = URL.createObjectURL(arquivo)
  try {
    foto = await carregarImagem(urlFotoLocal, false)
  } catch {
    erro.value = 'Não foi possível abrir essa foto. Tente outra (JPG ou PNG).'
    limparFoto()
    return
  }
  escalaBase = Math.max(janela.w / foto.naturalWidth, janela.h / foto.naturalHeight)
  centro = { x: janela.x + janela.w / 2, y: janela.y + janela.h / 2 }
  zoom.value = 1
  temFoto.value = true
  desenhar()
}

function desenhar() {
  const canvas = canvasRef.value
  if (!canvas || !moldura) return
  const W = moldura.naturalWidth
  const H = moldura.naturalHeight
  if (canvas.width !== W) canvas.width = W
  if (canvas.height !== H) canvas.height = H
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#1e293b'
  ctx.fillRect(0, 0, W, H)

  if (foto) {
    const escala = escalaBase * zoom.value
    const fw = foto.naturalWidth * escala
    const fh = foto.naturalHeight * escala
    ctx.drawImage(foto, centro.x - fw / 2, centro.y - fh / 2, fw, fh)
  } else {
    ctx.fillStyle = '#94a3b8'
    ctx.font = `bold ${Math.round(W * 0.04)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Escolha sua foto', janela.x + janela.w / 2, janela.y + janela.h / 2)
  }

  ctx.drawImage(moldura, 0, 0, W, H)
}

watch(zoom, desenhar)

// Arrastar a foto (mouse ou dedo): o deslocamento na tela vira pixels da moldura.
let arrastando: { id: number; x: number; y: number } | null = null

function onPointerDown(e: PointerEvent) {
  if (!foto) return
  arrastando = { id: e.pointerId, x: e.clientX, y: e.clientY }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!arrastando || arrastando.id !== e.pointerId || !canvasRef.value) return
  const rect = canvasRef.value.getBoundingClientRect()
  const fator = canvasRef.value.width / rect.width
  centro.x += (e.clientX - arrastando.x) * fator
  centro.y += (e.clientY - arrastando.y) * fator
  arrastando.x = e.clientX
  arrastando.y = e.clientY
  desenhar()
}

function onPointerUp(e: PointerEvent) {
  if (arrastando?.id === e.pointerId) arrastando = null
}

function nomeArquivo() {
  const slug = props.eventoNome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return `eu-vou-${slug || 'prova'}.jpg`
}

function gerarArquivo(): Promise<File> {
  return new Promise((resolve, reject) => {
    desenhar()
    canvasRef.value!.toBlob(
      (blob) => (blob ? resolve(new File([blob], nomeArquivo(), { type: 'image/jpeg' })) : reject(new Error('blob'))),
      'image/jpeg',
      0.92
    )
  })
}

async function baixar() {
  if (!temFoto.value) return
  gerando.value = true
  erro.value = ''
  try {
    const arquivo = await gerarArquivo()
    const url = URL.createObjectURL(arquivo)
    const a = document.createElement('a')
    a.href = url
    a.download = arquivo.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } catch {
    erro.value = 'Não foi possível gerar a imagem. Tente de novo.'
  } finally {
    gerando.value = false
  }
}

async function compartilhar() {
  if (!temFoto.value) return
  gerando.value = true
  erro.value = ''
  try {
    const arquivo = await gerarArquivo()
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], title: `Eu vou! ${props.eventoNome}` })
    } else {
      await baixar()
    }
  } catch (e) {
    // Fechar a janela de compartilhar não é erro.
    if ((e as Error)?.name !== 'AbortError') {
      erro.value = 'Não foi possível compartilhar. Use o botão Baixar.'
    }
  } finally {
    gerando.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="aberto"
      class="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-4"
      @keydown.window.escape="emit('fechar')"
    >
      <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="emit('fechar')"></div>

      <div class="relative z-[401] flex w-full max-w-md max-h-[94vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4 shrink-0">
          <div class="min-w-0">
            <h3 class="font-black text-base text-slate-900">Minha arte "Eu vou"</h3>
            <p class="text-xs text-slate-500 truncate">{{ eventoNome }}</p>
          </div>
          <button type="button" class="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200" aria-label="Fechar" @click="emit('fechar')">
            <X :size="16" />
          </button>
        </div>

        <div class="overflow-y-auto px-5 py-4 space-y-4">
          <p v-if="erro" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{{ erro }}</p>

          <div v-if="carregandoMoldura" class="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 :size="18" class="animate-spin" /> Carregando a moldura...
          </div>

          <template v-else>
            <div class="mx-auto w-full" :class="molduraAlta ? 'max-w-[250px]' : 'max-w-[320px]'">
              <canvas
                ref="canvasRef"
                class="w-full rounded-2xl border border-slate-200 shadow-sm touch-none select-none"
                :class="temFoto ? 'cursor-grab active:cursor-grabbing' : ''"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
              ></canvas>
              <p v-if="temFoto" class="mt-1.5 text-center text-[11px] text-slate-400">Arraste a foto para encaixar</p>
            </div>

            <input ref="inputFotoRef" type="file" accept="image/*" class="hidden" @change="onFoto" />
            <button
              type="button"
              class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary hover:bg-primary/10 transition"
              @click="inputFotoRef?.click()"
            >
              <ImagePlus :size="18" /> {{ temFoto ? 'Trocar foto' : 'Escolher minha foto' }}
            </button>

            <label v-if="temFoto" class="flex items-center gap-3 text-xs font-bold text-slate-600">
              <ZoomIn :size="16" class="shrink-0" />
              <input v-model.number="zoom" type="range" min="1" max="3" step="0.01" class="w-full accent-primary" />
            </label>
          </template>
        </div>

        <div v-if="!carregandoMoldura" class="flex gap-2 border-t border-slate-100 px-5 py-4 shrink-0">
          <button
            v-if="podeCompartilhar"
            type="button"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-3 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100 transition disabled:opacity-40"
            :disabled="!temFoto || gerando"
            @click="compartilhar"
          >
            <Share2 :size="15" /> Compartilhar
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-wider text-white hover:brightness-95 transition disabled:opacity-40"
            :disabled="!temFoto || gerando"
            @click="baixar"
          >
            <Loader2 v-if="gerando" :size="15" class="animate-spin" />
            <Download v-else :size="15" /> Baixar arte
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
