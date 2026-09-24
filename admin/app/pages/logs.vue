<script setup lang="ts">
import { AlertTriangle, AlertCircle, CheckCircle, Info, RefreshCw, Search, ChevronDown } from 'lucide-vue-next'
import type { AuditLogItem } from '../composables/useAdminLogs'

// A rota /logs estava no menu desde 19/08, mas a pagina nunca chegou ao git:
// o link dava 404. O backend (/admin/logs) e a composable ja existiam.
const { logs, totalLogs, totalPaginas, fetchLogs } = useAdminLogs()

type FiltroNivel = '' | 'ERROR' | 'WARN' | 'INFO' | 'SUCCESS'
const nivel = ref<FiltroNivel>('')
const categoria = ref('')
const busca = ref('')
const pagina = ref(1)
const carregando = ref(true)
const erro = ref('')
const aberto = ref<string | null>(null)
const atualizarSozinho = ref(true)
const ultimaAtualizacao = ref<Date | null>(null)

const abasNivel: { valor: FiltroNivel; label: string }[] = [
  { valor: '', label: 'Todos' },
  { valor: 'ERROR', label: 'Erros' },
  { valor: 'WARN', label: 'Avisos' },
  { valor: 'SUCCESS', label: 'Sucesso' },
  { valor: 'INFO', label: 'Informações' }
]

const categorias = [
  { valor: '', label: 'Todas as áreas' },
  { valor: 'OPERACIONAL', label: 'Operacional' },
  { valor: 'FINANCEIRO', label: 'Financeiro' },
  { valor: 'SEGURANCA', label: 'Segurança' },
  { valor: 'ASAAS_WEBHOOK', label: 'Webhook de pagamento' }
]

async function carregar(silencioso = false) {
  if (!silencioso) carregando.value = true
  erro.value = ''
  try {
    await fetchLogs({
      nivel: nivel.value || undefined,
      categoria: categoria.value || undefined,
      busca: busca.value.trim() || undefined,
      pagina: pagina.value
    })
    ultimaAtualizacao.value = new Date()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(() => carregar())

watch([nivel, categoria], () => {
  pagina.value = 1
  carregar()
})
watch(pagina, () => carregar())

let temporizadorBusca: ReturnType<typeof setTimeout> | null = null
watch(busca, () => {
  if (temporizadorBusca) clearTimeout(temporizadorBusca)
  temporizadorBusca = setTimeout(() => {
    pagina.value = 1
    carregar()
  }, 400)
})

// Atualiza a cada 15s so na primeira pagina, onde entram os registros novos;
// nas outras a lista andaria sozinha enquanto a pessoa le.
let temporizador: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  temporizador = setInterval(() => {
    if (atualizarSozinho.value && pagina.value === 1 && !aberto.value && document.visibilityState === 'visible') {
      carregar(true)
    }
  }, 15_000)
})
onBeforeUnmount(() => {
  if (temporizador) clearInterval(temporizador)
  if (temporizadorBusca) clearTimeout(temporizadorBusca)
})

function estiloNivel(n: AuditLogItem['nivel']) {
  switch (n) {
    case 'ERROR':
      return { icone: AlertCircle, classe: 'bg-red-50 text-red-700 border-red-200', rotulo: 'Erro' }
    case 'WARN':
      return { icone: AlertTriangle, classe: 'bg-amber-50 text-amber-800 border-amber-200', rotulo: 'Aviso' }
    case 'SUCCESS':
      return { icone: CheckCircle, classe: 'bg-emerald-50 text-emerald-700 border-emerald-200', rotulo: 'Sucesso' }
    default:
      return { icone: Info, classe: 'bg-slate-50 text-slate-600 border-slate-200', rotulo: 'Info' }
  }
}

function rotuloCategoria(c: string) {
  return categorias.find((x) => x.valor === c)?.label || c
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatarDetalhes(d: unknown) {
  if (d === null || d === undefined) return ''
  try {
    return JSON.stringify(d, null, 2)
  } catch {
    return String(d)
  }
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-xl font-black text-slate-900">Logs do Sistema</h1>
        <p class="mt-1 text-sm text-slate-500">
          Erros inesperados do servidor e eventos importantes (pagamentos, segurança). Atualiza sozinho a cada 15
          segundos.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <label class="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
          <input v-model="atualizarSozinho" type="checkbox" class="h-4 w-4 accent-orange-500" />
          Atualizar sozinho
        </label>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-slate-300 transition"
          @click="carregar()"
        >
          <RefreshCw :size="14" :class="carregando ? 'animate-spin' : ''" /> Atualizar
        </button>
      </div>
    </header>

    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="aba in abasNivel"
        :key="aba.label"
        type="button"
        class="rounded-xl border px-3.5 py-2 text-xs font-bold transition"
        :class="
          nivel === aba.valor
            ? 'border-orange-500 bg-orange-50 text-orange-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
        "
        @click="nivel = aba.valor"
      >
        {{ aba.label }}
      </button>

      <select
        v-model="categoria"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:border-orange-400"
      >
        <option v-for="c in categorias" :key="c.valor" :value="c.valor">{{ c.label }}</option>
      </select>

      <div class="relative flex-1 min-w-[200px]">
        <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          v-model="busca"
          type="text"
          placeholder="Buscar na mensagem (ex.: pagamento, rota, e-mail...)"
          class="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:border-orange-400"
        />
      </div>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p class="text-xs text-slate-400">
      {{ totalLogs }} registro(s)
      <span v-if="ultimaAtualizacao"> · atualizado às {{ ultimaAtualizacao.toLocaleTimeString('pt-BR') }}</span>
    </p>

    <p v-if="carregando && logs.length === 0" class="py-10 text-center text-sm text-slate-400">Carregando...</p>

    <p
      v-else-if="logs.length === 0"
      class="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400"
    >
      Nenhum registro com esses filtros.
    </p>

    <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
      <div v-for="item in logs" :key="item.id">
        <button
          type="button"
          class="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition"
          @click="aberto = aberto === item.id ? null : item.id"
        >
          <span
            class="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            :class="estiloNivel(item.nivel).classe"
          >
            <component :is="estiloNivel(item.nivel).icone" :size="11" />
            {{ estiloNivel(item.nivel).rotulo }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-slate-800 break-words">{{ item.mensagem }}</p>
            <p class="mt-0.5 text-[11px] text-slate-400">
              {{ formatarData(item.createdAt) }} · {{ rotuloCategoria(item.categoria) }}
              <span v-if="item.ip"> · IP {{ item.ip }}</span>
            </p>
          </div>
          <ChevronDown
            v-if="item.detalhes"
            :size="16"
            class="mt-1 shrink-0 text-slate-400 transition"
            :class="aberto === item.id ? 'rotate-180' : ''"
          />
        </button>
        <pre
          v-if="aberto === item.id && item.detalhes"
          class="mx-4 mb-3 max-h-80 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100 whitespace-pre-wrap break-words"
        >{{ formatarDetalhes(item.detalhes) }}</pre>
      </div>
    </div>

    <div v-if="totalPaginas > 1" class="flex items-center justify-center gap-3">
      <button
        type="button"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"
        :disabled="pagina <= 1"
        @click="pagina--"
      >
        Anterior
      </button>
      <span class="text-xs font-semibold text-slate-500">Página {{ pagina }} de {{ totalPaginas }}</span>
      <button
        type="button"
        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-40"
        :disabled="pagina >= totalPaginas"
        @click="pagina++"
      >
        Próxima
      </button>
    </div>
  </div>
</template>
