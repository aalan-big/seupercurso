<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Timer, Clock, CheckCircle2, Upload, FileText, XCircle, AlertTriangle } from 'lucide-vue-next'
import {
  useCotacaoCronometragem,
  SERVICOS_CRONOMETRAGEM,
  rotuloServico,
  type CotacaoCronometragem
} from '~/composables/useCotacaoCronometragem'

// Cartao isolado: qualquer erro aqui fica aqui, o resto da pagina de
// cronometragem segue funcionando.
const props = defineProps<{ eventoId: string }>()

const config = useRuntimeConfig()
const { listar, solicitar, aceitar, recusar, cancelar, enviarComprovante } = useCotacaoCronometragem()
const { confirmar } = useConfirmacao()

const cotacoes = ref<CotacaoCronometragem[]>([])
const carregando = ref(true)
const processando = ref(false)
const erro = ref('')
const sucesso = ref('')
const mostrarForm = ref(false)

const form = reactive({
  servicos: ['CHIP', 'TAPETE', 'PORTICO', 'RESULTADO_ONLINE'] as string[],
  atletasEstimados: '' as string | number,
  pontosPassagem: '' as string | number,
  observacoes: ''
})

const ABERTAS = ['SOLICITADA', 'ORCADA', 'ACEITA', 'PAGA']

const doEvento = computed(() => cotacoes.value.filter((c) => c.eventoId === props.eventoId))
const atual = computed(
  () => doEvento.value.find((c) => ABERTAS.includes(c.status)) ?? doEvento.value[0] ?? null
)
const podePedir = computed(() => !atual.value || !ABERTAS.includes(atual.value.status))

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    cotacoes.value = await listar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
watch(
  () => props.eventoId,
  () => {
    mostrarForm.value = false
    sucesso.value = ''
    erro.value = ''
  }
)

async function executar(acao: () => Promise<unknown>, mensagem: string) {
  erro.value = ''
  sucesso.value = ''
  processando.value = true
  try {
    await acao()
    sucesso.value = mensagem
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processando.value = false
  }
}

function numeroOuUndefined(v: string | number) {
  const n = Number(v)
  return v === '' || !Number.isFinite(n) ? undefined : n
}

async function onSolicitar() {
  if (form.servicos.length === 0) {
    erro.value = 'Marque pelo menos um serviço.'
    return
  }
  await executar(
    () =>
      solicitar(props.eventoId, {
        servicos: form.servicos,
        atletasEstimados: numeroOuUndefined(form.atletasEstimados),
        pontosPassagem: numeroOuUndefined(form.pontosPassagem),
        observacoes: form.observacoes.trim() || undefined
      }),
    'Cotação enviada! A equipe do Seu Percurso vai responder com a proposta por aqui e por e-mail.'
  )
  if (!erro.value) mostrarForm.value = false
}

async function onAceitar() {
  if (!atual.value) return
  const ok = await confirmar({
    titulo: 'Aceitar a proposta?',
    mensagem: `Você contrata a cronometragem por ${formatarValor(atual.value.valor)}. Depois de aceitar aparecem os dados para pagamento.`,
    textoConfirmar: 'Aceitar proposta'
  })
  if (!ok) return
  const id = atual.value.id
  await executar(() => aceitar(id), 'Proposta aceita! Veja abaixo os dados para pagamento.')
}

async function onRecusar() {
  if (!atual.value) return
  const ok = await confirmar({
    titulo: 'Recusar a proposta?',
    mensagem: 'A cotação é encerrada. Se mudar de ideia, dá para pedir uma nova.',
    textoConfirmar: 'Recusar',
    perigo: true
  })
  if (!ok) return
  const id = atual.value.id
  await executar(() => recusar(id), 'Proposta recusada.')
}

async function onCancelar() {
  if (!atual.value) return
  const ok = await confirmar({
    titulo: 'Cancelar a cotação?',
    mensagem: 'A equipe do Seu Percurso é avisada. Se mudar de ideia, dá para pedir uma nova.',
    textoConfirmar: 'Cancelar cotação',
    perigo: true
  })
  if (!ok) return
  const id = atual.value.id
  await executar(() => cancelar(id), 'Cotação cancelada.')
}

async function onComprovante(evento: Event) {
  const input = evento.target as HTMLInputElement
  const arquivo = input.files?.[0]
  input.value = ''
  if (!atual.value || !arquivo) return
  if (arquivo.size > 10 * 1024 * 1024) {
    erro.value = 'O comprovante pode ter no máximo 10 MB.'
    return
  }
  const id = atual.value.id
  await executar(
    () => enviarComprovante(id, arquivo),
    'Comprovante enviado! A equipe confirma o pagamento e você recebe um e-mail.'
  )
}

function formatarValor(valor: string | null) {
  return valor === null
    ? '—'
    : Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'
}

const comprovanteLink = computed(() =>
  atual.value?.comprovanteUrl ? urlFoto(atual.value.comprovanteUrl, config.public.apiBase as string) : null
)

const ROTULO_SITUACAO: Record<string, { texto: string; classe: string }> = {
  SOLICITADA: { texto: 'Aguardando orçamento', classe: 'bg-amber-100 text-amber-800' },
  ORCADA: { texto: 'Proposta recebida', classe: 'bg-sky-100 text-sky-800' },
  EXPIRADA: { texto: 'Proposta vencida', classe: 'bg-slate-200 text-slate-700' },
  ACEITA: { texto: 'Aguardando pagamento', classe: 'bg-amber-100 text-amber-800' },
  PAGA: { texto: 'Cronometragem confirmada', classe: 'bg-emerald-100 text-emerald-800' },
  CONCLUIDA: { texto: 'Concluída', classe: 'bg-emerald-100 text-emerald-800' },
  RECUSADA: { texto: 'Proposta recusada', classe: 'bg-slate-200 text-slate-700' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-slate-200 text-slate-700' }
}
</script>

<template>
  <div class="rounded-3xl border border-orange-200 bg-orange-50/50 p-5 sm:p-6 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Timer :size="16" class="text-orange-600" /> Cronometragem oficial Seu Percurso
        </h2>
        <p class="text-xs text-slate-600 mt-1">
          Peça uma cotação: a equipe do Seu Percurso cronometra a sua prova com chip, tapetes e resultado online.
        </p>
      </div>
      <span
        v-if="atual && !carregando"
        class="self-start rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider whitespace-nowrap"
        :class="ROTULO_SITUACAO[atual.situacao]?.classe"
      >
        {{ ROTULO_SITUACAO[atual.situacao]?.texto ?? atual.situacao }}
      </span>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700 flex items-center gap-2">
      <AlertTriangle :size="14" class="shrink-0" /> {{ erro }}
    </p>
    <p v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
      <CheckCircle2 :size="14" class="shrink-0" /> {{ sucesso }}
    </p>

    <p v-if="carregando" class="text-xs text-slate-500">Carregando...</p>

    <template v-else>
      <!-- Cotacao em andamento -->
      <div v-if="atual && !podePedir" class="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-sm">
        <p class="text-xs text-slate-500">
          Pedida em {{ formatarData(atual.createdAt) }} ·
          {{ atual.servicos.map(rotuloServico).join(', ') }}
          <template v-if="atual.atletasEstimados"> · ~{{ atual.atletasEstimados }} atletas</template>
        </p>

        <p v-if="atual.situacao === 'SOLICITADA'" class="flex items-center gap-2 text-slate-700">
          <Clock :size="15" class="text-amber-600" /> A equipe do Seu Percurso está preparando o orçamento. Você recebe um e-mail quando a proposta chegar.
        </p>

        <template v-if="['ORCADA', 'EXPIRADA', 'ACEITA', 'PAGA'].includes(atual.situacao)">
          <div class="flex flex-wrap items-end gap-x-8 gap-y-2">
            <div>
              <p class="text-xs font-semibold text-slate-500">Valor</p>
              <p class="text-xl font-black text-slate-900">{{ formatarValor(atual.valor) }}</p>
            </div>
            <div v-if="atual.situacao === 'ORCADA' || atual.situacao === 'EXPIRADA'">
              <p class="text-xs font-semibold text-slate-500">Proposta válida até</p>
              <p class="font-bold text-slate-800">{{ formatarData(atual.propostaValidaAte) }}</p>
            </div>
            <div v-if="atual.situacao !== 'PAGA'">
              <p class="text-xs font-semibold text-slate-500">Pagamento até</p>
              <p class="font-bold text-slate-800">{{ formatarData(atual.pagamentoAte) }}</p>
            </div>
          </div>
          <div v-if="atual.descricaoProposta" class="rounded-xl bg-slate-50 p-3">
            <p class="text-xs font-semibold text-slate-500 mb-1">O que está incluso</p>
            <p class="text-sm text-slate-700 whitespace-pre-wrap">{{ atual.descricaoProposta }}</p>
          </div>
        </template>

        <p v-if="atual.situacao === 'EXPIRADA'" class="text-xs font-semibold text-slate-600">
          Esta proposta venceu. Fale com a
          <NuxtLink to="/suporte" class="font-bold underline">equipe do Seu Percurso</NuxtLink>
          para receber uma proposta atualizada.
        </p>

        <!-- Aceita: dados de pagamento e comprovante -->
        <template v-if="atual.situacao === 'ACEITA'">
          <div class="rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p class="text-xs font-black uppercase tracking-wider text-amber-900 mb-1">Dados para pagamento</p>
            <p v-if="atual.dadosPagamento" class="text-sm text-slate-800 whitespace-pre-wrap">{{ atual.dadosPagamento }}</p>
            <p v-else class="text-sm text-slate-700">A equipe do Seu Percurso vai enviar os dados para pagamento.</p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <label
              class="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-800 transition flex items-center gap-1.5"
              :class="{ 'pointer-events-none opacity-50': processando }"
            >
              <Upload :size="14" /> {{ atual.comprovanteUrl ? 'Trocar comprovante' : 'Enviar comprovante' }}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" class="hidden" @change="onComprovante" />
            </label>
            <a
              v-if="comprovanteLink"
              :href="comprovanteLink"
              target="_blank"
              rel="noopener"
              class="text-xs font-bold text-slate-700 underline flex items-center gap-1"
            >
              <FileText :size="13" /> Comprovante enviado em {{ formatarData(atual.comprovanteEnviadoEm) }}
            </a>
          </div>
        </template>

        <p v-if="atual.situacao === 'PAGA'" class="flex items-center gap-2 font-semibold text-emerald-800">
          <CheckCircle2 :size="15" /> Pagamento confirmado em {{ formatarData(atual.pagaEm) }}. A equipe vai alinhar os detalhes da prova com você.
        </p>

        <div class="flex flex-wrap gap-2 pt-1">
          <template v-if="atual.situacao === 'ORCADA'">
            <button
              type="button"
              :disabled="processando"
              class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-700 transition disabled:opacity-50"
              @click="onAceitar"
            >
              Aceitar proposta
            </button>
            <button
              type="button"
              :disabled="processando"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
              @click="onRecusar"
            >
              Recusar
            </button>
          </template>
          <button
            v-if="['SOLICITADA', 'EXPIRADA', 'ACEITA'].includes(atual.situacao)"
            type="button"
            :disabled="processando"
            class="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1"
            @click="onCancelar"
          >
            <XCircle :size="14" /> Cancelar cotação
          </button>
        </div>
      </div>

      <!-- Ultima cotacao encerrada, so como referencia -->
      <p v-if="atual && podePedir && !mostrarForm" class="text-xs text-slate-500">
        Última cotação: {{ ROTULO_SITUACAO[atual.situacao]?.texto ?? atual.situacao }} em {{ formatarData(atual.createdAt) }}.
        <template v-if="atual.motivo"> Motivo: {{ atual.motivo }}</template>
      </p>

      <!-- Pedir cotacao -->
      <button
        v-if="podePedir && !mostrarForm"
        type="button"
        class="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-orange-700 transition flex items-center gap-1.5"
        @click="mostrarForm = true"
      >
        <Timer :size="14" /> Solicitar cotação de cronometragem
      </button>

      <div v-if="podePedir && mostrarForm" class="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <div>
          <p class="text-xs font-bold text-slate-700 mb-2">O que você precisa?</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label
              v-for="s in SERVICOS_CRONOMETRAGEM"
              :key="s.chave"
              class="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                v-model="form.servicos"
                type="checkbox"
                :value="s.chave"
                class="h-4 w-4 rounded border-slate-300 accent-orange-600"
              />
              {{ s.rotulo }}
            </label>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="text-xs font-semibold text-slate-500">
            Atletas esperados
            <input
              v-model="form.atletasEstimados"
              type="number"
              min="1"
              placeholder="Ex.: 500"
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </label>
          <label class="text-xs font-semibold text-slate-500">
            Pontos de passagem (parciais)
            <input
              v-model="form.pontosPassagem"
              type="number"
              min="0"
              max="50"
              placeholder="Ex.: 1"
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </label>
        </div>
        <label class="block text-xs font-semibold text-slate-500">
          Observações (opcional)
          <textarea
            v-model="form.observacoes"
            rows="3"
            maxlength="2000"
            placeholder="Horário da largada, percursos, o que mais for importante..."
            class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </label>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="processando"
            class="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-orange-700 transition disabled:opacity-50"
            @click="onSolicitar"
          >
            {{ processando ? 'Enviando...' : 'Enviar pedido de cotação' }}
          </button>
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
            @click="mostrarForm = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
