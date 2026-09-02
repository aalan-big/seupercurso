<script setup lang="ts">
import type { AlteracaoDocumentoAdmin } from '../composables/useAdminAlteracoesDocumento'

const { listar, aprovar, rejeitar } = useAdminAlteracoesDocumento()
const config = useRuntimeConfig()

const solicitacoes = ref<AlteracaoDocumentoAdmin[]>([])
const filtro = ref<'PENDENTE' | 'APROVADA' | 'REJEITADA' | ''>('PENDENTE')
const carregando = ref(true)
const erro = ref('')
const processandoId = ref<string | null>(null)
const motivoRecusa = reactive<Record<string, string>>({})

const abas = [
  { valor: 'PENDENTE' as const, label: 'Pendentes' },
  { valor: 'APROVADA' as const, label: 'Aprovadas' },
  { valor: 'REJEITADA' as const, label: 'Rejeitadas' },
  { valor: '' as const, label: 'Todas' }
]

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    solicitacoes.value = await listar(filtro.value || undefined)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
watch(filtro, carregar)

function formatarDocumento(valor: string) {
  const d = valor.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return valor
}

function nomeDoCliente(s: AlteracaoDocumentoAdmin) {
  return s.cliente.pf?.nomeCompleto || s.cliente.pj?.razaoSocial || s.cliente.usuario.email
}

function linkDocumento(caminho: string) {
  return urlFoto(caminho, config.public.apiBase as string)
}

async function onAprovar(s: AlteracaoDocumentoAdmin) {
  if (
    !confirm(
      `Confirmar a troca de ${s.tipo} de ${formatarDocumento(s.documentoAtual)} para ${formatarDocumento(s.documentoNovo)}?\n\nA conta de recebimento no Asaas será invalidada e precisará ser recriada pelo organizador.`
    )
  ) {
    return
  }

  erro.value = ''
  processandoId.value = s.id
  try {
    await aprovar(s.id)
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processandoId.value = null
  }
}

async function onRejeitar(s: AlteracaoDocumentoAdmin) {
  const motivo = (motivoRecusa[s.id] || '').trim()
  if (!motivo) {
    erro.value = 'Informe o motivo da recusa para que o solicitante saiba o que corrigir.'
    return
  }

  erro.value = ''
  processandoId.value = s.id
  try {
    await rejeitar(s.id, motivo)
    motivoRecusa[s.id] = ''
    await carregar()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processandoId.value = null
  }
}
</script>

<template>
  <div class="space-y-5">
    <header>
      <h1 class="text-xl font-black text-slate-900">Alteração de CPF/CNPJ</h1>
      <p class="mt-1 text-sm text-slate-500">
        O documento define para qual conta o organizador consegue sacar. Confira a foto enviada
        contra os dados do cadastro antes de aprovar.
      </p>
    </header>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="aba in abas"
        :key="aba.label"
        type="button"
        class="rounded-xl border px-3.5 py-2 text-xs font-bold transition"
        :class="
          filtro === aba.valor
            ? 'border-orange-500 bg-orange-50 text-orange-700'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
        "
        @click="filtro = aba.valor"
      >
        {{ aba.label }}
      </button>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="carregando" class="py-10 text-center text-sm text-slate-400">Carregando...</p>

    <p
      v-else-if="solicitacoes.length === 0"
      class="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400"
    >
      Nenhuma solicitação nesta aba.
    </p>

    <div v-else class="space-y-4">
      <article
        v-for="s in solicitacoes"
        :key="s.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-black text-slate-900">{{ nomeDoCliente(s) }}</h2>
            <p class="text-xs text-slate-500">{{ s.cliente.usuario.email }}</p>
            <p v-if="s.cliente.organizador" class="mt-1 text-[11px] font-bold text-orange-700">
              É organizador ({{ s.cliente.organizador.status }}) — a troca invalida a conta de recebimento
            </p>
          </div>
          <span
            class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
            :class="{
              'bg-amber-100 text-amber-800': s.status === 'PENDENTE',
              'bg-emerald-100 text-emerald-800': s.status === 'APROVADA',
              'bg-red-100 text-red-700': s.status === 'REJEITADA'
            }"
          >
            {{ s.status }}
          </span>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">{{ s.tipo }} atual</p>
            <p class="mt-1 font-mono text-sm font-bold text-slate-700">
              {{ formatarDocumento(s.documentoAtual) }}
            </p>
          </div>
          <div class="rounded-xl bg-orange-50 p-3">
            <p class="text-[10px] font-black uppercase tracking-wider text-orange-500">{{ s.tipo }} solicitado</p>
            <p class="mt-1 font-mono text-sm font-black text-orange-800">
              {{ formatarDocumento(s.documentoNovo) }}
            </p>
          </div>
          <div class="rounded-xl bg-slate-50 p-3">
            <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Documento enviado</p>
            <a
              :href="linkDocumento(s.arquivoUrl) || '#'"
              target="_blank"
              rel="noopener"
              class="mt-1 inline-block text-sm font-bold text-orange-600 underline"
            >
              Abrir comprovante
            </a>
          </div>
        </div>

        <p v-if="s.motivo" class="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <strong class="text-slate-700">Justificativa:</strong> {{ s.motivo }}
        </p>

        <p
          v-if="s.status === 'REJEITADA' && s.motivoRejeicao"
          class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
        >
          <strong>Recusada:</strong> {{ s.motivoRejeicao }}
        </p>

        <div v-if="s.status === 'PENDENTE'" class="space-y-3 border-t border-slate-100 pt-3">
          <input
            v-model="motivoRecusa[s.id]"
            type="text"
            placeholder="Motivo, caso vá recusar"
            class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs focus:border-orange-500 focus:outline-none"
          />
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :disabled="processandoId === s.id"
              class="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-emerald-500 disabled:opacity-50"
              @click="onAprovar(s)"
            >
              Aprovar troca
            </button>
            <button
              type="button"
              :disabled="processandoId === s.id"
              class="rounded-xl border border-red-300 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              @click="onRejeitar(s)"
            >
              Recusar
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
