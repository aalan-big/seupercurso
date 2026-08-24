<script setup lang="ts">
import type { LoteOrganizador, ModalidadeOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  eventoId: string
  lotes: LoteOrganizador[]
  modalidades: ModalidadeOrganizador[]
}>()

const { criarLote, atualizarLote, removerLote, definirPreco } = useEventoOrganizador()

const erro = ref('')
const salvando = ref(false)

const mostrarFormLote = ref(false)
const novoLote = reactive({ nome: '', quantidade: '', inicioVenda: '', fimVenda: '' })

async function onCriarLote() {
  erro.value = ''
  if (!novoLote.nome || !novoLote.inicioVenda || !novoLote.fimVenda) {
    erro.value = 'Informe nome e a janela de venda do lote.'
    return
  }

  salvando.value = true
  try {
    await criarLote(props.eventoId, {
      nome: novoLote.nome,
      quantidade: novoLote.quantidade ? Number(novoLote.quantidade) : undefined,
      inicioVenda: novoLote.inicioVenda,
      fimVenda: novoLote.fimVenda
    })
    novoLote.nome = ''
    novoLote.quantidade = ''
    novoLote.inicioVenda = ''
    novoLote.fimVenda = ''
    mostrarFormLote.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onRemoverLote(loteId: string) {
  erro.value = ''
  salvando.value = true
  try {
    await removerLote(props.eventoId, loteId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

const loteEditandoId = ref<string | null>(null)
const edicaoLote = reactive({ nome: '', quantidade: '', inicioVenda: '', fimVenda: '' })

function abrirEdicao(lote: LoteOrganizador) {
  loteEditandoId.value = lote.id
  edicaoLote.nome = lote.nome
  edicaoLote.quantidade = lote.quantidade ? String(lote.quantidade) : ''
  edicaoLote.inicioVenda = lote.inicioVenda.slice(0, 10)
  edicaoLote.fimVenda = lote.fimVenda.slice(0, 10)
}

function cancelarEdicao() {
  loteEditandoId.value = null
}

async function onSalvarEdicao(loteId: string) {
  erro.value = ''
  if (!edicaoLote.nome || !edicaoLote.inicioVenda || !edicaoLote.fimVenda) {
    erro.value = 'Informe nome e a janela de venda do lote.'
    return
  }

  salvando.value = true
  try {
    await atualizarLote(props.eventoId, loteId, {
      nome: edicaoLote.nome,
      quantidade: edicaoLote.quantidade ? Number(edicaoLote.quantidade) : undefined,
      inicioVenda: edicaoLote.inicioVenda,
      fimVenda: edicaoLote.fimVenda
    })
    loteEditandoId.value = null
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

function precoAtual(lote: LoteOrganizador, modalidadeId: string) {
  return lote.precos.find((p) => p.modalidadeId === modalidadeId)?.valor ?? ''
}

async function onSalvarPreco(loteId: string, modalidadeId: string, e: Event) {
  const input = e.target as HTMLInputElement
  const valor = Number(input.value)
  if (!input.value || Number.isNaN(valor)) return

  erro.value = ''
  try {
    await definirPreco(props.eventoId, loteId, modalidadeId, valor)
  } catch (err) {
    erro.value = extrairErro(err)
  }
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}
</script>

<template>
  <div>
    <p v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="modalidades.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      Cadastre uma modalidade primeiro pra poder definir preços por lote.
    </p>

    <template v-else>
      <div v-if="lotes.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Nenhum lote cadastrado ainda. Sem lote e preço, o evento fica com "Em breve" no site.
      </div>

      <div v-else class="flex flex-col gap-4">
        <div
          v-for="lote in lotes"
          :key="lote.id"
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div v-if="loteEditandoId === lote.id">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                v-model="edicaoLote.nome"
                type="text"
                placeholder="Nome (ex.: 1º Lote)"
                class="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <div>
                <label class="mb-1 block text-xs font-semibold text-slate-500">Início da venda</label>
                <input
                  v-model="edicaoLote.inicioVenda"
                  type="date"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold text-slate-500">Fim da venda</label>
                <input
                  v-model="edicaoLote.fimVenda"
                  type="date"
                  class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <input
                v-model="edicaoLote.quantidade"
                type="number"
                min="1"
                placeholder="Quantidade de vagas (opcional)"
                class="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div class="mt-3 flex gap-2">
              <button
                type="button"
                :disabled="salvando"
                class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
                @click="onSalvarEdicao(lote.id)"
              >
                {{ salvando ? 'Salvando...' : 'Salvar' }}
              </button>
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
                @click="cancelarEdicao"
              >
                Cancelar
              </button>
            </div>
          </div>

          <div v-else class="flex items-center justify-between gap-3">
            <div>
              <p class="font-bold text-slate-800">{{ lote.nome }}</p>
              <p class="mt-0.5 text-xs text-slate-400">
                Vendas de {{ formatarData(lote.inicioVenda) }} até {{ formatarData(lote.fimVenda) }}
                <template v-if="lote.quantidade"> · {{ lote.quantidade }} vagas</template>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="text-xs font-bold uppercase tracking-wide text-secondary hover:underline"
                @click="abrirEdicao(lote)"
              >
                Editar
              </button>
              <button
                type="button"
                class="text-xs font-bold uppercase tracking-wide text-red-600 hover:text-red-700"
                @click="onRemoverLote(lote.id)"
              >
                Remover
              </button>
            </div>
          </div>

          <!-- Tabela/Cards de Preços por Modalidade (Mobile Friendly) -->
          <div class="mt-4 flex flex-col gap-2.5 border-t border-slate-200 pt-3">
            <p class="text-[11px] font-black uppercase tracking-wider text-amber-950 flex items-center gap-1">
              <span>💰 Preço das Modalidades neste Lote (Digite e troque de campo para salvar):</span>
            </p>
            <div
              v-for="modalidade in modalidades"
              :key="modalidade.id"
              class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50/50 p-3 shadow-xs"
            >
              <div class="flex items-center gap-2">
                <span class="rounded-lg bg-amber-200/60 px-2 py-0.5 text-xs font-black text-amber-950">🏃 {{ modalidade.distanciaKm }} km</span>
                <span class="font-extrabold text-xs text-slate-900">{{ modalidade.nome }}</span>
              </div>
              <div class="flex items-center gap-2 self-end sm:self-auto">
                <label class="text-xs font-bold text-slate-600">Valor (R$):</label>
                <input
                  :value="precoAtual(lote, modalidade.id)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="w-32 rounded-xl border-2 border-amber-400 bg-white px-3 py-2 text-xs font-black text-slate-900 shadow-xs focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                  @change="(e) => onSalvarPreco(lote.id, modalidade.id, e)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-4">
        <button
          v-if="!mostrarFormLote"
          type="button"
          class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
          @click="mostrarFormLote = true"
        >
          + Novo lote
        </button>

        <div v-else class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              v-model="novoLote.nome"
              type="text"
              placeholder="Nome (ex.: 1º Lote)"
              class="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-500">Início da venda</label>
              <input
                v-model="novoLote.inicioVenda"
                type="date"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs font-semibold text-slate-500">Fim da venda</label>
              <input
                v-model="novoLote.fimVenda"
                type="date"
                class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <input
              v-model="novoLote.quantidade"
              type="number"
              min="1"
              placeholder="Quantidade de vagas (opcional)"
              class="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <p class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
            💡 <strong>Dica para Celular:</strong> Após clicar em <strong>Salvar Lote</strong>, os campos em destaque amarelo para preencher o preço em R$ de cada modalidade aparecerão no card do lote acima!
          </p>

          <div class="mt-3 flex gap-2">
            <button
              type="button"
              :disabled="salvando"
              class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
              @click="onCriarLote"
            >
              {{ salvando ? 'Salvando...' : 'Salvar lote' }}
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
              @click="mostrarFormLote = false"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
