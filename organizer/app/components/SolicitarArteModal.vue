<script setup lang="ts">
import { Palette, X, Loader2, Copy, Check, QrCode } from 'lucide-vue-next'
import type { SolicitacaoArte } from '../composables/useSolicitacaoArte'

const props = defineProps<{
  aberto: boolean
  eventoId: string
  eventoNome: string
  solicitacaoExistente?: SolicitacaoArte | null
}>()
const emit = defineEmits<{ fechar: []; solicitado: [] }>()

const { obterPreco, solicitar } = useSolicitacaoArte()

const etapa = ref<'form' | 'gerando' | 'pix'>('form')
const preco = ref<number | null>(null)
const observacoes = ref('')
const erro = ref('')
const pixCopiaECola = ref('')
const pixQrCodeUrl = ref('')
const valorCobrado = ref('')
const pixCopiado = ref(false)

watch(
  () => props.aberto,
  async (aberto) => {
    if (!aberto) return
    erro.value = ''

    // Já existe uma solicitação aguardando pagamento pra esse evento — reabre
    // a tela do PIX já gerado, sem criar uma cobrança nova.
    if (props.solicitacaoExistente && props.solicitacaoExistente.status === 'PENDENTE_PAGAMENTO') {
      valorCobrado.value = props.solicitacaoExistente.valor
      pixCopiaECola.value = props.solicitacaoExistente.pixCopiaECola || ''
      pixQrCodeUrl.value = props.solicitacaoExistente.pixQrCodeUrl || ''
      etapa.value = 'pix'
      return
    }

    etapa.value = 'form'
    observacoes.value = ''
    preco.value = null
    try {
      const res = await obterPreco()
      preco.value = Number(res.precoArteEvento)
    } catch (e) {
      erro.value = extrairErro(e)
    }
  }
)

function fechar() {
  emit('fechar')
}

async function confirmarSolicitacao() {
  erro.value = ''
  etapa.value = 'gerando'
  try {
    const res = await solicitar(props.eventoId, observacoes.value.trim() || undefined)
    valorCobrado.value = res.valor
    pixCopiaECola.value = res.pixCopiaECola || ''
    pixQrCodeUrl.value = res.pixQrCodeUrl || ''
    etapa.value = 'pix'
    emit('solicitado')
  } catch (e) {
    erro.value = extrairErro(e)
    etapa.value = 'form'
  }
}

function copiarPix() {
  if (!pixCopiaECola.value) return
  navigator.clipboard.writeText(pixCopiaECola.value)
  pixCopiado.value = true
  setTimeout(() => { pixCopiado.value = false }, 3000)
}

function formatarValor(valor: number | string) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="aberto" class="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div class="fixed inset-0 bg-slate-950/75 backdrop-blur-xs" @click="fechar"></div>

      <div class="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl z-[301] p-6 space-y-5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-4">
          <h3 class="flex items-center gap-2 font-black text-base text-slate-900">
            <Palette :size="20" class="text-accent" /> Solicitar Arte do Evento
          </h3>
          <button type="button" class="rounded-xl bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 transition" @click="fechar">
            <X :size="14" />
          </button>
        </div>

        <p v-if="erro" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{{ erro }}</p>

        <!-- Etapa 1: Formulário -->
        <div v-if="etapa === 'form'" class="space-y-4">
          <p class="text-sm text-slate-600">
            Nossa equipe cria a arte/banner oficial do <strong>{{ eventoNome }}</strong> pra você. Descreva o estilo que imagina (cores, referências) e confirme o pagamento via PIX.
          </p>

          <div>
            <label class="mb-1 block text-xs font-bold uppercase text-slate-500">Observações (opcional)</label>
            <textarea
              v-model="observacoes"
              rows="3"
              placeholder="Ex.: cores da minha marca são azul e laranja, gosto de um estilo esportivo/moderno..."
              class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            ></textarea>
          </div>

          <div class="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <span class="text-xs font-bold uppercase text-slate-500">Valor do serviço</span>
            <span class="text-xl font-black text-slate-900">{{ preco !== null ? formatarValor(preco) : '...' }}</span>
          </div>

          <button
            type="button"
            :disabled="preco === null"
            class="w-full rounded-xl bg-accent px-4 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-95 disabled:opacity-50"
            @click="confirmarSolicitacao"
          >
            Confirmar e Pagar com PIX
          </button>
        </div>

        <!-- Etapa 2: Gerando -->
        <div v-else-if="etapa === 'gerando'" class="py-10 text-center space-y-3">
          <Loader2 :size="32" class="mx-auto animate-spin text-accent" />
          <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Gerando seu QR Code PIX...</p>
        </div>

        <!-- Etapa 3: PIX -->
        <div v-else class="space-y-4">
          <div class="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <img v-if="pixQrCodeUrl" :src="pixQrCodeUrl" alt="QR Code PIX" class="h-48 w-48 rounded-xl bg-white p-1" />
            <div v-else class="flex h-48 w-48 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-400">
              <QrCode :size="32" />
            </div>
            <p class="mt-2 text-center text-[11px] font-semibold text-slate-500">Abra o app do seu banco e escaneie o código acima.</p>
          </div>

          <div class="space-y-1 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Valor</p>
            <p class="text-2xl font-black text-emerald-600">{{ formatarValor(valorCobrado) }}</p>
          </div>

          <div v-if="pixCopiaECola" class="space-y-2">
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600">Código PIX Copia e Cola</label>
            <div class="flex gap-2">
              <input type="text" readonly :value="pixCopiaECola" class="w-full truncate rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-700" />
              <button
                type="button"
                class="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-black text-white transition hover:brightness-95"
                @click="copiarPix"
              >
                <template v-if="pixCopiado"><Check :size="14" /> Copiado!</template>
                <template v-else><Copy :size="14" /> Copiar</template>
              </button>
            </div>
          </div>

          <p class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
            Assim que o pagamento for confirmado, sua solicitação entra na fila de produção da nossa equipe.
          </p>

          <button type="button" class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold uppercase text-slate-600 hover:bg-slate-100" @click="fechar">
            Fechar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
