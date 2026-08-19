<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { InscricaoComEvento } from '~/composables/useInscricao'

const { token } = useAuth()
const { minhasInscricoes, fetchMinhas, cancelar } = useInscricao()

const carregando = ref(true)
const erro = ref('')
const abaAtiva = ref<'proximos' | 'historico'>('proximos')

const confirmandoId = ref<string | null>(null)
const cancelandoId = ref<string | null>(null)
const erroCancelar = ref('')

const modal360Aberto = ref(false)
const inscricaoModalId = ref<string | null>(null)

const inscricaoModal = computed(() => {
  if (!inscricaoModalId.value) return null
  return minhasInscricoes.value.find((i) => i.id === inscricaoModalId.value) || null
})

function abrirModal360(inscricao: InscricaoComEvento) {
  inscricaoModalId.value = inscricao.id
  modal360Aberto.value = true
}

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login?redirect=/meus-eventos')
    return
  }
  try {
    await fetchMinhas()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

function formatarData(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatarDataExtensa(iso?: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatarTempo(segundos?: number | null) {
  if (!segundos) return '--:--:--'
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  return `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Filtra inscrições em 'Próximos / Recentes' vs 'Histórico / Concluídos'
const eventosProximos = computed(() => {
  const agora = new Date()
  return minhasInscricoes.value.filter((i) => {
    if (i.status === 'CANCELADA' || i.status === 'EXPIRADA') return false
    const dataFim = i.categoria.modalidade.evento.dataFim ? new Date(i.categoria.modalidade.evento.dataFim) : null
    // Se a data de término for no futuro ou hoje/ontem
    if (dataFim) {
      const umDiaDepois = new Date(dataFim.getTime() + 24 * 60 * 60 * 1000)
      return umDiaDepois >= agora
    }
    return true
  })
})

const eventosHistorico = computed(() => {
  const agora = new Date()
  return minhasInscricoes.value.filter((i) => {
    if (i.status === 'CANCELADA' || i.status === 'EXPIRADA') return true
    const dataFim = i.categoria.modalidade.evento.dataFim ? new Date(i.categoria.modalidade.evento.dataFim) : null
    if (dataFim) {
      const umDiaDepois = new Date(dataFim.getTime() + 24 * 60 * 60 * 1000)
      return umDiaDepois < agora
    }
    return false
  })
})

const statusInfo: Record<string, { texto: string; classe: string; icone: string }> = {
  PENDENTE_PAGAMENTO: { texto: 'Aguardando Pagamento', classe: 'bg-amber-100 text-amber-800 border-amber-300', icone: '⏳' },
  CONFIRMADA: { texto: 'Inscrição Confirmada', classe: 'bg-emerald-100 text-emerald-800 border-emerald-300', icone: '✅' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-red-100 text-red-700 border-red-200', icone: '❌' },
  EXPIRADA: { texto: 'Expirada', classe: 'bg-slate-100 text-slate-600 border-slate-200', icone: '🕒' }
}

async function confirmarCancelamento(id: string) {
  erroCancelar.value = ''
  cancelandoId.value = id
  try {
    await cancelar(id)
    confirmandoId.value = null
  } catch (e) {
    erroCancelar.value = extrairErro(e)
  } finally {
    cancelandoId.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
    <div class="mx-auto max-w-4xl">
      <!-- Cabeçalho -->
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-3xl font-extrabold uppercase tracking-tight text-slate-900">
            Meus <span class="text-secondary">Eventos</span>
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Gerencie suas inscrições recentes, consulte a retirada de kits e veja seu histórico de provas.
          </p>
        </div>
        <NuxtLink
          to="/#eventos"
          class="inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-primary shadow-sm transition hover:brightness-95 self-start sm:self-auto"
        >
          🔍 Explorar Mais Eventos
        </NuxtLink>
      </div>

      <!-- Abas de Navegação -->
      <div class="mt-6 flex border-b border-slate-200">
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition"
          :class="
            abaAtiva === 'proximos'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          "
          @click="abaAtiva = 'proximos'"
        >
          Próximos & Recentes
          <span
            class="ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold"
            :class="abaAtiva === 'proximos' ? 'bg-secondary/10 text-secondary' : 'bg-slate-200 text-slate-600'"
          >
            {{ eventosProximos.length }}
          </span>
        </button>
        <button
          type="button"
          class="flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition"
          :class="
            abaAtiva === 'historico'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          "
          @click="abaAtiva = 'historico'"
        >
          Histórico & Concluídos
          <span
            class="ml-1 rounded-full px-2 py-0.5 text-xs font-extrabold"
            :class="abaAtiva === 'historico' ? 'bg-secondary/10 text-secondary' : 'bg-slate-200 text-slate-600'"
          >
            {{ eventosHistorico.length }}
          </span>
        </button>
      </div>

      <!-- Estado de Carregamento -->
      <div v-if="carregando" class="mt-12 text-center py-12 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div class="inline-block animate-spin text-3xl text-secondary">🌀</div>
        <p class="mt-3 text-sm font-semibold text-slate-500">Carregando seus eventos...</p>
      </div>

      <!-- Mensagem de Erro -->
      <div v-else-if="erro" class="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
        ⚠️ {{ erro }}
      </div>

      <!-- Conteúdo da Aba: PRÓXIMOS & RECENTES -->
      <div v-else-if="abaAtiva === 'proximos'" class="mt-6">
        <!-- Nenhum evento próximo -->
        <div
          v-if="eventosProximos.length === 0"
          class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"
        >
          <div class="text-5xl">👟</div>
          <h3 class="mt-4 text-lg font-bold text-slate-800">Você não possui eventos futuros ou recentes inscritos</h3>
          <p class="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Que tal escolher o seu próximo desafio? Explore as provas disponíveis e garanta sua vaga.
          </p>
          <NuxtLink
            to="/#eventos"
            class="mt-6 inline-block rounded-xl bg-warning px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary shadow hover:brightness-95"
          >
            Ver Calendário de Eventos
          </NuxtLink>
        </div>

        <!-- Lista de Cards Próximos -->
        <div v-else class="flex flex-col gap-6">
          <div
            v-for="inscricao in eventosProximos"
            :key="inscricao.id"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <!-- Faixa Superior com Nome do Evento e Status -->
            <div class="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Evento</span>
                  <span class="text-xs text-slate-300">•</span>
                  <span class="text-xs font-semibold text-slate-500">Inscrito em {{ formatarData(inscricao.dataInscricao) }}</span>
                </div>
                <h2 class="text-xl font-black tracking-tight text-slate-900 mt-0.5">
                  {{ inscricao.categoria.modalidade.evento.nome }}
                </h2>
              </div>
              <div class="flex items-center gap-2 self-start sm:self-auto">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-xs"
                  :class="statusInfo[inscricao.status]?.classe || 'bg-slate-100 text-slate-600 border-slate-200'"
                >
                  <span>{{ statusInfo[inscricao.status]?.icone }}</span>
                  <span>{{ statusInfo[inscricao.status]?.texto || inscricao.status }}</span>
                </span>
              </div>
            </div>

            <!-- Corpo do Card -->
            <div class="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <!-- Coluna 1: Data, Local e Modalidade -->
              <div class="space-y-3 md:col-span-2">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div class="flex items-start gap-2.5">
                    <span class="text-base text-secondary">📅</span>
                    <div>
                      <p class="text-xs font-semibold uppercase text-slate-400">Data da Prova</p>
                      <p class="font-bold text-slate-800">
                        {{ formatarDataExtensa(inscricao.categoria.modalidade.evento.dataInicio) }}
                      </p>
                    </div>
                  </div>

                  <div class="flex items-start gap-2.5">
                    <span class="text-base text-secondary">📍</span>
                    <div>
                      <p class="text-xs font-semibold uppercase text-slate-400">Local</p>
                      <p class="font-bold text-slate-800">
                        {{ inscricao.categoria.modalidade.evento.local }},
                        {{ inscricao.categoria.modalidade.evento.cidade }}/{{ inscricao.categoria.modalidade.evento.estado }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <span class="rounded-lg bg-secondary/10 px-3 py-1.5 text-xs font-extrabold text-secondary">
                    🏃 {{ inscricao.categoria.modalidade.nome }}
                  </span>
                  <span class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                    👥 {{ inscricao.categoria.nome }}
                  </span>
                  <span v-if="inscricao.tamanhoCamisa" class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                    👕 Camisa: <strong>{{ inscricao.tamanhoCamisa }}</strong>
                  </span>
                  <span v-if="inscricao.lote" class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                    🏷️ Lote: {{ inscricao.lote.nome }}
                  </span>
                </div>

                <!-- Informações sobre Kit -->
                <div
                  v-if="inscricao.categoria.modalidade.evento.retiradaKitLocal"
                  class="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900"
                >
                  <p class="font-bold flex items-center gap-1 text-blue-800">
                    📦 Retirada do Kit de Atleta:
                  </p>
                  <p class="mt-0.5 text-slate-600">
                    {{ inscricao.categoria.modalidade.evento.retiradaKitLocal }}
                    <span v-if="inscricao.categoria.modalidade.evento.retiradaKitInicio">
                      ({{ formatarData(inscricao.categoria.modalidade.evento.retiradaKitInicio) }} a {{ formatarData(inscricao.categoria.modalidade.evento.retiradaKitFim) }})
                    </span>
                  </p>
                  <p v-if="inscricao.kitEntregueEm" class="mt-1 font-bold text-emerald-700">
                    ✓ Kit entregue em {{ formatarData(inscricao.kitEntregueEm) }}
                  </p>
                </div>
              </div>

              <!-- Coluna 2: Número de Peito e Ações -->
              <div class="flex flex-col justify-between rounded-xl bg-slate-50 p-4 border border-slate-100">
                <div>
                  <p class="text-xs font-bold uppercase tracking-wider text-slate-400">Número de Peito</p>
                  <div class="mt-1">
                    <span
                      v-if="inscricao.numeroPeito"
                      class="text-3xl font-black tracking-tight text-primary font-mono"
                    >
                      #{{ inscricao.numeroPeito }}
                    </span>
                    <span v-else class="text-xs italic text-slate-400">
                      Será atribuído próximo à data da prova
                    </span>
                  </div>
                </div>

                <!-- Ações específicas por status -->
                <div class="mt-4 space-y-2">
                  <div v-if="inscricao.status === 'PENDENTE' || inscricao.status === 'PENDENTE_PAGAMENTO'" class="space-y-2">
                    <p v-if="erroCancelar && confirmandoId === inscricao.id" class="mb-2 text-xs text-red-600 font-bold">
                      {{ erroCancelar }}
                    </p>

                    <div v-if="confirmandoId === inscricao.id" class="space-y-2">
                      <p class="text-xs font-semibold text-slate-600">Confirmar cancelamento?</p>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          :disabled="cancelandoId === inscricao.id"
                          class="w-full rounded-lg bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                          @click="confirmarCancelamento(inscricao.id)"
                        >
                          {{ cancelandoId === inscricao.id ? 'Canc...' : 'Sim' }}
                        </button>
                        <button
                          type="button"
                          class="w-full rounded-lg border border-slate-300 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                          @click="confirmandoId = null"
                        >
                          Voltar
                        </button>
                      </div>
                    </div>
                    <div v-else class="space-y-2">
                      <NuxtLink
                        :to="`/pagamento/${inscricao.id}`"
                        class="block w-full text-center rounded-xl bg-accent py-2.5 text-xs font-bold uppercase tracking-wider text-primary shadow hover:brightness-95 transition"
                      >
                        💳 Efetuar Pagamento
                      </NuxtLink>
                      <button
                        type="button"
                        class="block w-full text-center rounded-xl bg-primary py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-slate-800 transition"
                        @click="abrirModal360(inscricao)"
                      >
                        📄 Ver Detalhes do Evento
                      </button>
                      <button
                        type="button"
                        class="w-full text-center text-xs font-bold text-red-600 hover:underline py-1"
                        @click="confirmandoId = inscricao.id"
                      >
                        Cancelar inscrição
                      </button>
                    </div>
                  </div>

                  <div v-else-if="inscricao.status === 'CONFIRMADA'">
                    <button
                      type="button"
                      class="block w-full text-center rounded-xl bg-primary py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-slate-800 transition"
                      @click="abrirModal360(inscricao)"
                    >
                      📄 Ver Detalhes do Evento
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Conteúdo da Aba: HISTÓRICO & CONCLUÍDOS -->
      <div v-else-if="abaAtiva === 'historico'" class="mt-6">
        <!-- Nenhum evento no histórico -->
        <div
          v-if="eventosHistorico.length === 0"
          class="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"
        >
          <div class="text-5xl">🎖️</div>
          <h3 class="mt-4 text-lg font-bold text-slate-800">Seu histórico de provas está vazio</h3>
          <p class="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Assim que você concluir provas e eventos passados, seus tempos, colocações e certificados aparecerão aqui.
          </p>
        </div>

        <!-- Lista do Histórico -->
        <div v-else class="flex flex-col gap-6">
          <div
            v-for="inscricao in eventosHistorico"
            :key="inscricao.id"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm opacity-95 transition hover:opacity-100"
          >
            <div class="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span class="text-xs font-semibold text-slate-400">Provas Concluídas</span>
                <h2 class="text-lg font-extrabold tracking-tight text-slate-800">
                  {{ inscricao.categoria.modalidade.evento.nome }}
                </h2>
              </div>
              <span
                class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold"
                :class="statusInfo[inscricao.status]?.classe || 'bg-slate-100 text-slate-600'"
              >
                {{ statusInfo[inscricao.status]?.texto || inscricao.status }}
              </span>
            </div>

            <div class="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="md:col-span-2 space-y-2">
                <p class="text-sm font-semibold text-slate-700">
                  📅 Prova realizada em {{ formatarData(inscricao.categoria.modalidade.evento.dataInicio) }}
                </p>
                <p class="text-sm text-slate-500">
                  📍 {{ inscricao.categoria.modalidade.evento.cidade }}/{{ inscricao.categoria.modalidade.evento.estado }}
                </p>
                <div class="flex gap-2 mt-2">
                  <span class="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    {{ inscricao.categoria.modalidade.nome }}
                  </span>
                  <span class="rounded bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                    {{ inscricao.categoria.nome }}
                  </span>
                </div>

                <!-- Resultado de Performance se existir -->
                <div v-if="inscricao.resultado" class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <p class="text-xs font-bold text-emerald-800 uppercase tracking-wider">⏱️ Seu Resultado:</p>
                  <div class="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="rounded-lg bg-white p-2 border border-emerald-200">
                      <p class="text-slate-400">Tempo Líquido</p>
                      <p class="font-mono font-bold text-emerald-700 text-sm">
                        {{ formatarTempo(inscricao.resultado.tempoLiquidoSegundos) }}
                      </p>
                    </div>
                    <div class="rounded-lg bg-white p-2 border border-emerald-200">
                      <p class="text-slate-400">Geral</p>
                      <p class="font-bold text-slate-800 text-sm">
                        #{{ inscricao.resultado.colocacaoGeral || '-' }}
                      </p>
                    </div>
                    <div class="rounded-lg bg-white p-2 border border-emerald-200">
                      <p class="text-slate-400">Categoria</p>
                      <p class="font-bold text-slate-800 text-sm">
                        #{{ inscricao.resultado.colocacaoCategoria || '-' }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Certificado e Ações -->
              <div class="flex flex-col justify-end gap-2 border-t border-slate-100 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
                <a
                  v-if="inscricao.certificado"
                  :href="inscricao.certificado.urlPdf"
                  target="_blank"
                  class="block w-full text-center rounded-xl bg-emerald-600 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow hover:bg-emerald-700 transition"
                >
                  📜 Baixar Certificado (PDF)
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal 360 do Evento -->
      <EventoModal360
        :aberto="modal360Aberto"
        :inscricao="inscricaoModal"
        @close="modal360Aberto = false"
      />
    </div>
  </div>
</template>
