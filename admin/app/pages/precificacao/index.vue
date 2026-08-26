<script setup lang="ts">
import { Tag, Palette } from 'lucide-vue-next'

const { obterPreco, atualizarPreco } = useAdminArte()

const precoAtual = ref<number | null>(null)
const editando = ref(false)
const novoPreco = ref(0)
const carregando = ref(true)
const salvando = ref(false)
const erro = ref('')
const sucesso = ref('')

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    const config = await obterPreco()
    precoAtual.value = Number(config.precoArteEvento)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

function abrirEdicao() {
  novoPreco.value = precoAtual.value ?? 0
  editando.value = true
}

async function salvar() {
  if (novoPreco.value < 0) {
    erro.value = 'O valor não pode ser negativo.'
    return
  }
  erro.value = ''
  sucesso.value = ''
  salvando.value = true
  try {
    const config = await atualizarPreco(novoPreco.value)
    precoAtual.value = Number(config.precoArteEvento)
    sucesso.value = 'Preço atualizado com sucesso.'
    editando.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
</script>

<template>
  <div class="space-y-6">
    <div class="border-b border-slate-200 pb-5">
      <h1 class="flex items-center gap-2 text-2xl font-black uppercase tracking-tight text-primary">
        <Tag :size="24" /> Precificação
      </h1>
      <p class="mt-1 text-xs text-slate-500">Preços dos serviços vendidos pela plataforma aos organizadores.</p>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">{{ sucesso }}</p>

    <p v-if="carregando" class="text-sm text-slate-500">Carregando...</p>

    <div v-else class="space-y-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 class="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
          <Palette :size="16" /> Preço do Serviço de Arte de Evento
        </h2>
        <p class="mt-1 text-[11px] text-slate-400">
          Valor cobrado do organizador via PIX ao clicar em "Solicitar Arte para o meu Evento". Ajuste aqui pra dar desconto em campanhas específicas.
        </p>

        <div v-if="!editando" class="mt-3 flex items-center gap-3">
          <span class="text-2xl font-black text-slate-900">{{ formatarValor(precoAtual ?? 0) }}</span>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100"
            @click="abrirEdicao"
          >
            Alterar
          </button>
        </div>

        <div v-else class="mt-3 flex flex-wrap items-center gap-2">
          <div class="relative">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
            <input
              v-model.number="novoPreco"
              type="number"
              min="0"
              step="1"
              class="w-32 rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm font-bold focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="button"
            :disabled="salvando"
            class="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-95 disabled:opacity-50"
            @click="salvar"
          >
            {{ salvando ? 'Salvando...' : 'Salvar' }}
          </button>
          <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100" @click="editando = false">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
