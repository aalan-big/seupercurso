<script setup lang="ts">
definePageMeta({ layout: 'staff' })

const { token } = useStaffAuth()
const { eventos, resultados, fetchEventos, buscar, confirmarEntrega, desfazerEntrega } = useStaffCheckin()

const eventoSelecionadoId = ref('')
const termoBusca = ref('')
const carregandoEventos = ref(true)
const buscando = ref(false)
const processandoId = ref<string | null>(null)
const erro = ref('')

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/staff/login')
    return
  }

  try {
    await fetchEventos()
    if (eventos.value.length > 0) {
      eventoSelecionadoId.value = eventos.value[0].id
    }
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoEventos.value = false
  }
})

async function onBuscar() {
  if (!eventoSelecionadoId.value || termoBusca.value.trim().length < 2) {
    resultados.value = []
    return
  }
  erro.value = ''
  buscando.value = true
  try {
    await buscar(eventoSelecionadoId.value, termoBusca.value.trim())
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    buscando.value = false
  }
}

function motivoBloqueio(item: (typeof resultados.value)[number]) {
  if (item.status !== 'CONFIRMADA') return 'Pagamento pendente — não libere o kit'
  return null
}

async function onConfirmar(inscricaoId: string) {
  erro.value = ''
  processandoId.value = inscricaoId
  try {
    await confirmarEntrega(eventoSelecionadoId.value, inscricaoId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processandoId.value = null
  }
}

async function onDesfazer(inscricaoId: string) {
  erro.value = ''
  processandoId.value = inscricaoId
  try {
    await desfazerEntrega(eventoSelecionadoId.value, inscricaoId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processandoId.value = null
  }
}

function formatarHora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function nomeCliente(item: (typeof resultados.value)[number]) {
  return item.cliente.pf?.nomeCompleto || '—'
}
const scannerAberto = ref(false)

function onQrCodeLido(codigo: string) {
  termoBusca.value = codigo.trim()
  onBuscar()
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-4">
    <div>
      <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Check-in de Kit (Painel do Staff)</h1>
      <p class="mt-1 text-sm text-slate-500">Busque o atleta ou escaneie o QR Code do e-mail.</p>
    </div>

    <p v-if="carregandoEventos" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="eventos.length === 0">
      <div class="mt-10 text-center">
        <div class="text-4xl">🎽</div>
        <p class="mt-3 text-slate-500">Nenhum evento disponível ainda.</p>
      </div>
    </template>

    <template v-else>
      <select
        v-model="eventoSelecionadoId"
        class="w-full rounded-xl border border-slate-300 px-4 py-3 text-base font-bold text-slate-800 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        @change="resultados = []"
      >
        <option v-for="evento in eventos" :key="evento.id" :value="evento.id">{{ evento.nome }}</option>
      </select>

      <!-- Botão de Câmera QR Code em Destaque -->
      <button
        type="button"
        class="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-primary p-4 text-sm font-extrabold uppercase tracking-wider text-white shadow-md hover:brightness-110 transition active:scale-[0.99]"
        @click="scannerAberto = true"
      >
        <span class="text-xl">📷</span>
        <span>Escanear QR Code do E-mail</span>
      </button>

      <div class="flex gap-2">
        <input
          v-model="termoBusca"
          type="text"
          placeholder="Nome, CPF ou número do peito..."
          class="w-full rounded-xl border border-slate-300 px-4 py-4 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          @keyup.enter="onBuscar"
        />
        <button
          type="button"
          :disabled="buscando"
          class="shrink-0 rounded-xl bg-warning px-5 py-4 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          @click="onBuscar"
        >
          {{ buscando ? '...' : 'Buscar' }}
        </button>
      </div>

      <!-- Componente Modal de Leitura de Câmera QR Code -->
      <QrCodeScannerModal
        :aberto="scannerAberto"
        @close="scannerAberto = false"
        @scan="onQrCodeLido"
      />

      <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ erro }}
      </p>

      <p v-if="!buscando && termoBusca.trim().length >= 2 && resultados.length === 0" class="mt-8 text-center text-sm text-slate-500">
        Nenhum inscrito encontrado.
      </p>

      <div class="mt-6 flex flex-col gap-3">
        <div
          v-for="item in resultados"
          :key="item.id"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p class="text-lg font-bold text-slate-800">{{ nomeCliente(item) }}</p>
          <p class="mt-1 text-sm text-slate-500">
            {{ item.categoria.modalidade.nome }} · {{ item.categoria.nome }}
            <template v-if="item.numeroPeito"> · Peito {{ item.numeroPeito }}</template>
            <template v-if="item.tamanhoCamisa"> · Camisa {{ item.tamanhoCamisa }}</template>
          </p>

          <p v-if="motivoBloqueio(item)" class="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
            ⚠️ {{ motivoBloqueio(item) }}
          </p>

          <div v-else-if="item.kitEntregueEm" class="mt-3 flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2">
            <span class="text-sm font-semibold text-accent">✅ Entregue às {{ formatarHora(item.kitEntregueEm) }}</span>
            <button
              type="button"
              :disabled="processandoId === item.id"
              class="text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700 disabled:opacity-50"
              @click="onDesfazer(item.id)"
            >
              Desfazer
            </button>
          </div>

          <button
            v-else
            type="button"
            :disabled="processandoId === item.id"
            class="mt-3 w-full rounded-xl bg-accent px-4 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:brightness-95 disabled:opacity-50"
            @click="onConfirmar(item.id)"
          >
            {{ processandoId === item.id ? 'Confirmando...' : 'Confirmar entrega do kit' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
