<script setup lang="ts">
import { Palette, Upload, Ban, CheckCircle, ExternalLink } from 'lucide-vue-next'
import type { SolicitacaoArteAdmin } from '../../composables/useAdminArte'

const { fetchLista, iniciarProducao, entregar, cancelar } = useAdminArte()
const config = useRuntimeConfig()

const filtro = ref<'PENDENTE_PAGAMENTO' | 'PAGO' | 'EM_PRODUCAO' | 'ENTREGUE' | 'CANCELADO' | ''>('PAGO')
const solicitacoes = ref<SolicitacaoArteAdmin[]>([])
const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const processandoId = ref<string | null>(null)
const mostrarCancelarId = ref<string | null>(null)
const motivoCancelamento = ref('')
const arquivosSelecionados = ref<Record<string, File | undefined>>({})

const abas = [
  { valor: 'PENDENTE_PAGAMENTO' as const, label: 'Aguardando Pagamento' },
  { valor: 'PAGO' as const, label: 'Pagas' },
  { valor: 'EM_PRODUCAO' as const, label: 'Em Produção' },
  { valor: 'ENTREGUE' as const, label: 'Entregues' },
  { valor: 'CANCELADO' as const, label: 'Canceladas' },
  { valor: '' as const, label: 'Todas' }
]

const statusClasse: Record<string, string> = {
  PENDENTE_PAGAMENTO: 'bg-slate-200 text-slate-600',
  PAGO: 'bg-warning/10 text-warning',
  EM_PRODUCAO: 'bg-blue-100 text-blue-700',
  ENTREGUE: 'bg-accent/10 text-accent',
  CANCELADO: 'bg-red-100 text-red-700'
}

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    solicitacoes.value = await fetchLista(filtro.value || undefined)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

watch(filtro, carregar)
onMounted(carregar)

function nomeOrganizador(s: SolicitacaoArteAdmin) {
  const cliente = s.organizador.cliente
  return cliente.pf?.nomeCompleto || cliente.pj?.razaoSocial || cliente.usuario.email
}

function formatarValor(valor: string) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function onIniciarProducao(id: string) {
  erro.value = ''
  sucesso.value = ''
  processandoId.value = id
  try {
    await iniciarProducao(id)
    sucesso.value = 'Solicitação marcada como em produção.'
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processandoId.value = null
  }
}

function onSelecionarArquivo(id: string, e: Event) {
  const input = e.target as HTMLInputElement
  arquivosSelecionados.value[id] = input.files?.[0]
}

async function onEntregar(id: string) {
  const arquivo = arquivosSelecionados.value[id]
  if (!arquivo) {
    erro.value = 'Selecione o arquivo da arte finalizada antes de entregar.'
    return
  }
  erro.value = ''
  sucesso.value = ''
  processandoId.value = id
  try {
    await entregar(id, arquivo)
    sucesso.value = 'Arte entregue com sucesso ao organizador.'
    delete arquivosSelecionados.value[id]
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processandoId.value = null
  }
}

async function onCancelar(id: string) {
  erro.value = ''
  sucesso.value = ''
  processandoId.value = id
  try {
    await cancelar(id, motivoCancelamento.value || undefined)
    sucesso.value = 'Solicitação cancelada.'
    mostrarCancelarId.value = null
    motivoCancelamento.value = ''
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processandoId.value = null
  }
}

function urlArquivo(caminho: string | null) {
  return urlFoto(caminho, config.public.apiBase as string)
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div class="min-w-0">
        <h1 class="flex items-center gap-2 text-2xl font-black uppercase tracking-tight text-primary">
          <Palette :size="24" /> Arte de Eventos
        </h1>
        <p class="mt-1 text-xs text-slate-500">
          Fila de solicitações de arte/banner pagas pelos organizadores. Produza e entregue o arquivo final aqui.
        </p>
      </div>
    </div>

    <div class="flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="aba in abas"
        :key="aba.valor"
        type="button"
        class="shrink-0 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold uppercase tracking-wide transition"
        :class="filtro === aba.valor ? 'border-primary bg-primary text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'"
        @click="filtro = aba.valor"
      >
        {{ aba.label }}
      </button>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">{{ sucesso }}</p>

    <p v-if="carregando" class="text-sm text-slate-500">Carregando...</p>

    <div v-else-if="solicitacoes.length === 0" class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
      Nenhuma solicitação de arte nessa situação.
    </div>

    <div v-else class="flex flex-col gap-4">
      <div
        v-for="s in solicitacoes"
        :key="s.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-black text-slate-900">{{ s.evento.nome }}</p>
            <p class="mt-0.5 truncate text-xs text-slate-500">{{ nomeOrganizador(s) }} · {{ formatarData(s.createdAt) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-black text-slate-800">{{ formatarValor(s.valor) }}</span>
            <span class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide" :class="statusClasse[s.status]">
              {{ s.status.replace('_', ' ') }}
            </span>
          </div>
        </div>

        <p v-if="s.observacoes" class="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <span class="font-bold text-slate-700">Observações do organizador:</span> {{ s.observacoes }}
        </p>

        <p v-if="s.motivoCancelamento" class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <span class="font-bold">Motivo do cancelamento:</span> {{ s.motivoCancelamento }}
        </p>

        <div v-if="s.status === 'ENTREGUE' && s.arquivoEntregueUrl" class="mt-3">
          <a :href="urlArquivo(s.arquivoEntregueUrl)!" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline">
            <ExternalLink :size="14" /> Ver arte entregue
          </a>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            v-if="s.status === 'PAGO'"
            type="button"
            :disabled="processandoId === s.id"
            class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-blue-700 disabled:opacity-50"
            @click="onIniciarProducao(s.id)"
          >
            Iniciar Produção
          </button>

          <template v-if="s.status === 'EM_PRODUCAO' || s.status === 'PAGO'">
            <input
              type="file"
              class="block min-w-0 max-w-full flex-1 basis-40 text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              @change="(e) => onSelecionarArquivo(s.id, e)"
            />
            <button
              type="button"
              :disabled="processandoId === s.id"
              class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-50"
              @click="onEntregar(s.id)"
            >
              <Upload :size="14" /> Entregar Arte
            </button>
          </template>

          <button
            v-if="['PENDENTE_PAGAMENTO', 'PAGO', 'EM_PRODUCAO'].includes(s.status)"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl border border-red-300 px-4 py-2 text-xs font-bold uppercase tracking-wide text-red-600 transition hover:bg-red-50"
            @click="mostrarCancelarId = mostrarCancelarId === s.id ? null : s.id; motivoCancelamento = ''"
          >
            <Ban :size="14" /> Cancelar
          </button>

          <span v-if="s.status === 'ENTREGUE'" class="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
            <CheckCircle :size="14" /> Entregue
          </span>
        </div>

        <div v-if="mostrarCancelarId === s.id" class="mt-3 space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
          <textarea
            v-model="motivoCancelamento"
            rows="2"
            placeholder="Motivo do cancelamento (opcional)"
            class="w-full rounded-lg border border-red-300 p-2 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
          ></textarea>
          <div class="flex gap-2">
            <button
              type="button"
              :disabled="processandoId === s.id"
              class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold uppercase text-white hover:bg-red-700 disabled:opacity-50"
              @click="onCancelar(s.id)"
            >
              Confirmar Cancelamento
            </button>
            <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100" @click="mostrarCancelarId = null">
              Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
