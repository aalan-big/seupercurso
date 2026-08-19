<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  aberto: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'scan', result: string): void
}>()

const cameraCarregando = ref(true)
const cameraErro = ref('')
let html5QrCodeScanner: any = null

watch(
  () => props.aberto,
  (val) => {
    if (val) {
      iniciarScanner()
    } else {
      pararScanner()
    }
  }
)

onUnmounted(() => {
  pararScanner()
})

function iniciarScanner() {
  cameraCarregando.value = true
  cameraErro.value = ''

  if (typeof window === 'undefined') return

  if (!(window as any).Html5Qrcode) {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
    script.onload = () => {
      executarLeitor()
    }
    script.onerror = () => {
      cameraErro.value = 'Não foi possível carregar o leitor de QR Code.'
      cameraCarregando.value = false
    }
    document.head.appendChild(script)
  } else {
    executarLeitor()
  }
}

function executarLeitor() {
  const Html5Qrcode = (window as any).Html5Qrcode
  if (!Html5Qrcode) return

  const container = document.getElementById('qr-reader-viewport')
  if (!container) return

  try {
    if (html5QrCodeScanner) {
      html5QrCodeScanner.clear()
    }

    html5QrCodeScanner = new Html5Qrcode('qr-reader-viewport')
    cameraCarregando.value = false

    html5QrCodeScanner
      .start(
        { facingMode: 'environment' }, // Dá preferência para a câmera traseira em celulares
        {
          fps: 10,
          qrbox: { width: 240, height: 240 }
        },
        (decodedText: string) => {
          // QR Code Lido com Sucesso!
          pararScanner()
          emit('scan', decodedText)
          emit('close')
        },
        () => {
          // Erro de framerate ignorado durante a busca
        }
      )
      .catch((err: any) => {
        cameraErro.value = 'Permissão de câmera negada ou câmera não encontrada.'
        cameraCarregando.value = false
      })
  } catch (e) {
    cameraErro.value = 'Erro ao inicializar câmera.'
    cameraCarregando.value = false
  }
}

function pararScanner() {
  if (html5QrCodeScanner) {
    try {
      html5QrCodeScanner.stop().catch(() => {}).then(() => {
        html5QrCodeScanner.clear()
        html5QrCodeScanner = null
      })
    } catch {
      html5QrCodeScanner = null
    }
  }
}

function fechar() {
  pararScanner()
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="aberto" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" @click="fechar"></div>

      <div class="relative w-full max-w-md overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl z-[301] p-6 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">📷</span>
            <div>
              <h3 class="font-bold text-sm">Leitor de QR Code do Atleta</h3>
              <p class="text-[11px] text-slate-400">Aproxime o QR Code do e-mail do atleta</p>
            </div>
          </div>
          <button
            type="button"
            class="rounded-xl bg-slate-800 p-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
            @click="fechar"
          >
            ✕ Fechar
          </button>
        </div>

        <div v-if="cameraErro" class="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center">
          ⚠️ {{ cameraErro }}
        </div>

        <div class="relative min-h-[280px] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800">
          <div v-if="cameraCarregando" class="text-xs text-slate-400 flex flex-col items-center gap-2">
            <span class="animate-spin text-2xl">⏳</span>
            Iniciando câmera...
          </div>
          <div id="qr-reader-viewport" class="w-full h-full"></div>
        </div>

        <p class="text-center text-[11px] text-slate-400">
          Dica: Funciona na webcam do computador ou na câmera traseira do smartphone.
        </p>
      </div>
    </div>
  </Teleport>
</template>
