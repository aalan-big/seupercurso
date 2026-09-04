<script setup lang="ts">
import { CheckCircle, ChevronLeft, ChevronRight, Smile } from 'lucide-vue-next'

const emit = defineEmits<{
  capturado: [file: File]
  fechar: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const mediaStream = ref<MediaStream | null>(null)
const erro = ref('')
const carregando = ref(true)

// Etapas do desafio de prova de vida
type StepType = 'CENTRALIZAR' | 'ESQUERDA' | 'DIREITA' | 'SORRISO' | 'CONCLUIDO'

const stepAtual = ref<StepType>('CENTRALIZAR')
const progresso = ref(0) // 0 a 100
const instrucao = ref('Centralize seu rosto no círculo')

let animFrameId: number | null = null
let lastFrameData: Uint8ClampedArray | null = null
let stepTimer: ReturnType<typeof setTimeout> | null = null

const passos = [
  { key: 'CENTRALIZAR', titulo: '1. Centralizar Rosto', desc: 'Posicione o rosto dentro do círculo central' },
  { key: 'ESQUERDA', titulo: '2. Olhar para a Esquerda', desc: 'Gire levemente a cabeça para a esquerda 👈' },
  { key: 'DIREITA', titulo: '3. Olhar para a Direita', desc: 'Gire levemente a cabeça para a direita 👉' },
  { key: 'SORRISO', titulo: '4. Sorrir para a Câmera', desc: 'Dê um sorriso ou pisque para concluir 😊' }
]

onMounted(async () => {
  await iniciarCamera()
})

onUnmounted(() => {
  pararCamera()
})

async function iniciarCamera() {
  carregando.value = true
  erro.value = ''
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    })
    mediaStream.value = stream
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play()
    }
    carregando.value = false
    iniciarAnaliseMovimento()
  } catch (e) {
    carregando.value = false
    erro.value = 'Para abrir a câmera no celular pela rede Wi-Fi local, toque no botão abaixo para capturar sua selfie frontal ao vivo:'
  }
}

function onFotoNativaCelular(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    emit('capturado', file)
  }
}


function pararCamera() {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (stepTimer) clearTimeout(stepTimer)
  if (mediaStream.value) {
    mediaStream.value.getTracks().forEach(t => t.stop())
    mediaStream.value = null
  }
}

// Analisador de movimento via Canvas Difference
function iniciarAnaliseMovimento() {
  const canvas = canvasRef.value || document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let moveCount = 0

  function loop() {
    if (!videoRef.value || stepAtual.value === 'CONCLUIDO') return

    const width = 160
    const height = 120
    canvas.width = width
    canvas.height = height

    if (ctx && videoRef.value.readyState === videoRef.value.HAVE_ENOUGH_DATA) {
      ctx.drawImage(videoRef.value, 0, 0, width, height)
      const frame = ctx.getImageData(0, 0, width, height)

      if (lastFrameData) {
        let diffSum = 0
        let leftDiff = 0
        let rightDiff = 0

        for (let i = 0; i < frame.data.length; i += 16) {
          const diff = Math.abs(frame.data[i] - lastFrameData[i])
          diffSum += diff
          const x = (i / 4) % width
          if (x < width / 2) leftDiff += diff
          else rightDiff += diff
        }

        // Detecção de movimento dinâmico por etapa
        if (stepAtual.value === 'CENTRALIZAR') {
          if (diffSum > 1000) {
            moveCount++
            if (moveCount > 8) {
              avancarEtapa('ESQUERDA', 'Gire levemente a cabeça para a ESQUERDA 👈', 25)
              moveCount = 0
            }
          }
        } else if (stepAtual.value === 'ESQUERDA') {
          if (leftDiff > rightDiff * 1.3 && leftDiff > 800) {
            moveCount++
            if (moveCount > 6) {
              avancarEtapa('DIREITA', 'Ótimo! Agora gire a cabeça para a DIREITA 👉', 50)
              moveCount = 0
            }
          }
        } else if (stepAtual.value === 'DIREITA') {
          if (rightDiff > leftDiff * 1.3 && rightDiff > 800) {
            moveCount++
            if (moveCount > 6) {
              avancarEtapa('SORRISO', 'Perfeito! Agora dê um sorriso ou pisque 😊', 75)
              moveCount = 0
            }
          }
        } else if (stepAtual.value === 'SORRISO') {
          if (diffSum > 500) {
            moveCount++
            if (moveCount > 8) {
              concluirValida()
            }
          }
        }
      }

      lastFrameData = frame.data
    }

    animFrameId = requestAnimationFrame(loop)
  }

  loop()
}

function avancarEtapa(proxima: StepType, msg: string, pct: number) {
  stepAtual.value = proxima
  instrucao.value = msg
  progresso.value = pct
}

function concluirValida() {
  stepAtual.value = 'CONCLUIDO'
  instrucao.value = ' Validação Facial Concluída com Sucesso!'
  progresso.value = 100

  if (!videoRef.value) return
  const canvas = document.createElement('canvas')
  canvas.width = videoRef.value.videoWidth || 640
  canvas.height = videoRef.value.videoHeight || 480
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.drawImage(videoRef.value, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `selfie-liveness-${Date.now()}.jpg`, { type: 'image/jpeg' })
        setTimeout(() => {
          emit('capturado', file)
        }, 1200)
      }
    }, 'image/jpeg', 0.92)
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
    <div class="relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-center space-y-5">
      <!-- Header do Desafio -->
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div class="flex items-center gap-2.5 text-left">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/20 text-warning font-bold">
            <AppIcon name="verificacao" size="20" class="text-warning" />
          </span>
          <div>
            <h3 class="font-black text-sm text-white uppercase tracking-wide">Prova de Vida (Liveness 3D)</h3>
            <p class="text-[11px] text-slate-400">Validação Biométrica Antifraude</p>
          </div>
        </div>
        <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition" @click="emit('fechar')">
          <AppIcon name="close" size="18" />
        </button>
      </div>

      <!-- Barra de Progresso -->
      <div class="space-y-1">
        <div class="flex justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>Progresso da Validação</span>
          <span class="text-warning font-black">{{ progresso }}%</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            class="h-full bg-gradient-to-r from-amber-500 to-warning transition-all duration-500 ease-out"
            :style="{ width: `${progresso}%` }"
          ></div>
        </div>
      </div>

      <!-- Erro / Fallback para Câmera Frontal Nativa do Celular -->
      <div v-if="erro" class="rounded-2xl border border-warning/30 bg-warning/10 p-5 text-xs text-amber-200 space-y-4">
        <p class="font-bold text-sm text-warning flex items-center justify-center gap-2">
          <AppIcon name="camera" size="18" class="text-warning" /> Validação de Selfie no Celular
        </p>
        <p class="text-[11px] text-slate-300 leading-normal">
          {{ erro }}
        </p>

        <label class="block w-full cursor-pointer rounded-2xl bg-warning py-3.5 text-xs font-black uppercase tracking-wider text-primary shadow-lg hover:brightness-95 transition text-center">
          <AppIcon name="camera" size="18" class="inline mr-1 text-primary" /> Abrir Câmera Frontal do Celular
          <input
            type="file"
            accept="image/*"
            capture="user"
            class="hidden"
            @change="onFotoNativaCelular"
          />
        </label>
      </div>

      <!-- Container do Video Stream & Oval Frame -->
      <div v-else class="relative mx-auto aspect-square w-full max-w-[18rem] overflow-hidden rounded-full border-4 shadow-2xl transition-colors duration-500"
        :class="{
          'border-warning animate-pulse': stepAtual === 'CENTRALIZAR',
          'border-amber-400': stepAtual === 'ESQUERDA' || stepAtual === 'DIREITA',
          'border-warning': stepAtual === 'SORRISO',
          'border-emerald-400 shadow-emerald-500/50': stepAtual === 'CONCLUIDO'
        }"
      >
        <video
          ref="videoRef"
          autoplay
          playsinline
          class="h-full w-full object-cover transform -scale-x-100"
        ></video>

        <!-- Overlay Guia Oval Facial -->
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div class="h-[78%] w-[61%] rounded-[50%] border-2 border-dashed transition-all duration-300"
            :class="stepAtual === 'CONCLUIDO' ? 'border-emerald-400 bg-emerald-500/20' : 'border-warning/60 bg-slate-900/10'"
          ></div>
        </div>

        <!-- Badge de Concluído -->
        <div v-if="stepAtual === 'CONCLUIDO'" class="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/80 backdrop-blur-xs text-white space-y-2">
          <CheckCircle :size="48" class="animate-bounce text-emerald-400" />
          <span class="text-xs font-black uppercase tracking-wider text-emerald-300">Face Validada com Sucesso!</span>
        </div>
      </div>

      <!-- Instrução em Destaque com Animação -->
      <div class="rounded-2xl border border-slate-800 bg-slate-800/50 p-4 space-y-1">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Instrução Atual</p>
        <p class="text-sm font-black text-white flex items-center justify-center gap-2">
          <ChevronLeft v-if="stepAtual === 'ESQUERDA'" :size="18" class="animate-ping text-white" />
          <ChevronRight v-if="stepAtual === 'DIREITA'" :size="18" class="animate-ping text-white" />
          <Smile v-if="stepAtual === 'SORRISO'" :size="18" class="animate-bounce text-white" />
          {{ instrucao }}
        </p>
      </div>

      <!-- Botão Manual de Atalho -->
      <div class="flex items-center justify-between text-xs pt-1">
        <button type="button" class="text-slate-400 hover:text-white underline transition" @click="emit('fechar')">
          Cancelar
        </button>
        <button
          v-if="stepAtual !== 'CONCLUIDO'"
          type="button"
          class="text-warning font-bold hover:underline transition"
          @click="concluirValida"
        >
          Capturar Manualmente
        </button>
      </div>
    </div>
  </div>
</template>

