<script setup lang="ts">
import type { ModalidadeOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  eventoId: string
  modalidades: ModalidadeOrganizador[]
}>()

const { criarModalidade, atualizarModalidade, removerModalidade, criarCategoria, removerCategoria } =
  useEventoOrganizador()

const generoOpcoes = [
  { valor: 'LIVRE' as const, label: 'Livre' },
  { valor: 'MASCULINO' as const, label: 'Masculino' },
  { valor: 'FEMININO' as const, label: 'Feminino' }
]

const erro = ref('')
const salvando = ref(false)

const mostrarFormModalidade = ref(false)
const novaModalidade = reactive({ nome: '', distanciaKm: '', descricao: '', idadeMinima: '', idadeMaxima: '' })

async function onCriarModalidade() {
  erro.value = ''
  const distanciaKm = Number(novaModalidade.distanciaKm)
  if (!novaModalidade.nome || !distanciaKm) {
    erro.value = 'Informe nome e distância da modalidade.'
    return
  }

  salvando.value = true
  try {
    await criarModalidade(props.eventoId, {
      nome: novaModalidade.nome,
      distanciaKm,
      descricao: novaModalidade.descricao || undefined,
      idadeMinima: novaModalidade.idadeMinima ? Number(novaModalidade.idadeMinima) : undefined,
      idadeMaxima: novaModalidade.idadeMaxima ? Number(novaModalidade.idadeMaxima) : undefined
    })
    novaModalidade.nome = ''
    novaModalidade.distanciaKm = ''
    novaModalidade.descricao = ''
    novaModalidade.idadeMinima = ''
    novaModalidade.idadeMaxima = ''
    mostrarFormModalidade.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onRemoverModalidade(modalidadeId: string) {
  erro.value = ''
  salvando.value = true
  try {
    await removerModalidade(props.eventoId, modalidadeId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onToggleAtivo(modalidade: ModalidadeOrganizador) {
  erro.value = ''
  try {
    await atualizarModalidade(props.eventoId, modalidade.id, { ativo: !modalidade.ativo })
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

const modalidadeEditandoId = ref<string | null>(null)
const edicaoModalidade = reactive({ nome: '', distanciaKm: '', descricao: '', idadeMinima: '', idadeMaxima: '' })

function abrirEdicao(modalidade: ModalidadeOrganizador) {
  modalidadeEditandoId.value = modalidade.id
  edicaoModalidade.nome = modalidade.nome
  edicaoModalidade.distanciaKm = modalidade.distanciaKm
  edicaoModalidade.descricao = modalidade.descricao || ''
  edicaoModalidade.idadeMinima = modalidade.idadeMinima ? String(modalidade.idadeMinima) : ''
  edicaoModalidade.idadeMaxima = modalidade.idadeMaxima ? String(modalidade.idadeMaxima) : ''
}

function cancelarEdicao() {
  modalidadeEditandoId.value = null
}

async function onSalvarEdicao(modalidadeId: string) {
  erro.value = ''
  const distanciaKm = Number(edicaoModalidade.distanciaKm)
  if (!edicaoModalidade.nome || !distanciaKm) {
    erro.value = 'Informe nome e distância da modalidade.'
    return
  }

  salvando.value = true
  try {
    await atualizarModalidade(props.eventoId, modalidadeId, {
      nome: edicaoModalidade.nome,
      distanciaKm,
      descricao: edicaoModalidade.descricao || undefined,
      idadeMinima: edicaoModalidade.idadeMinima ? Number(edicaoModalidade.idadeMinima) : undefined,
      idadeMaxima: edicaoModalidade.idadeMaxima ? Number(edicaoModalidade.idadeMaxima) : undefined
    })
    modalidadeEditandoId.value = null
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

const modalidadeAbertaId = ref<string | null>(null)
const novaCategoria = reactive({ nome: '', idadeMinima: '', idadeMaxima: '', genero: 'LIVRE' as const, pcd: false })

function abrirCategorias(modalidadeId: string) {
  modalidadeAbertaId.value = modalidadeAbertaId.value === modalidadeId ? null : modalidadeId
}

async function onCriarCategoria(modalidadeId: string) {
  erro.value = ''
  if (!novaCategoria.nome) {
    erro.value = 'Informe o nome da categoria.'
    return
  }

  salvando.value = true
  try {
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: novaCategoria.nome,
      idadeMinima: novaCategoria.idadeMinima ? Number(novaCategoria.idadeMinima) : undefined,
      idadeMaxima: novaCategoria.idadeMaxima ? Number(novaCategoria.idadeMaxima) : undefined,
      genero: novaCategoria.genero,
      pcd: novaCategoria.pcd
    })
    novaCategoria.nome = ''
    novaCategoria.pcd = false
    novaCategoria.idadeMinima = ''
    novaCategoria.idadeMaxima = ''
    novaCategoria.genero = 'LIVRE'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onRemoverCategoria(modalidadeId: string, categoriaId: string) {
  erro.value = ''
  try {
    await removerCategoria(props.eventoId, modalidadeId, categoriaId)
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

function faixaEtaria(min: number | null, max: number | null) {
  if (!min && !max) return 'Todas as idades'
  if (min && max) return `${min} a ${max} anos`
  if (min) return `A partir de ${min} anos`
  return `Até ${max} anos`
}
</script>

<template>
  <div>
    <p v-if="erro" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <div v-if="modalidades.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      Nenhuma modalidade cadastrada ainda. Adicione o percurso (ex.: 5km, 10km) que os atletas vão poder escolher.
    </div>

    <div v-else class="flex flex-col gap-4">
      <div
        v-for="modalidade in modalidades"
        :key="modalidade.id"
        class="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div v-if="modalidadeEditandoId === modalidade.id" class="p-4">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              v-model="edicaoModalidade.nome"
              type="text"
              placeholder="Nome (ex.: 10km)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              v-model="edicaoModalidade.distanciaKm"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Distância (km)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              v-model="edicaoModalidade.idadeMinima"
              type="number"
              min="0"
              placeholder="Idade mín. (opcional)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <input
              v-model="edicaoModalidade.idadeMaxima"
              type="number"
              min="0"
              placeholder="Idade máx. (opcional)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <textarea
              v-model="edicaoModalidade.descricao"
              placeholder="Descrição (opcional)"
              rows="2"
              class="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            ></textarea>
          </div>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              :disabled="salvando"
              class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
              @click="onSalvarEdicao(modalidade.id)"
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

        <div v-else class="flex items-center justify-between gap-3 p-4">
          <div>
            <p class="font-bold text-slate-800">{{ modalidade.nome }} · {{ modalidade.distanciaKm }} km</p>
            <p class="mt-0.5 text-xs text-slate-400">{{ faixaEtaria(modalidade.idadeMinima, modalidade.idadeMaxima) }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
              :class="modalidade.ativo ? 'bg-accent/10 text-accent' : 'bg-slate-100 text-slate-500'"
              @click="onToggleAtivo(modalidade)"
            >
              {{ modalidade.ativo ? 'Ativa' : 'Inativa' }}
            </button>
            <button
              type="button"
              class="text-xs font-bold uppercase tracking-wide text-secondary hover:underline"
              @click="abrirEdicao(modalidade)"
            >
              Editar
            </button>
            <button
              type="button"
              class="text-xs font-bold uppercase tracking-wide text-red-600 hover:text-red-700"
              @click="onRemoverModalidade(modalidade.id)"
            >
              Remover
            </button>
          </div>
        </div>

        <div class="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            class="text-xs font-bold uppercase tracking-wide text-secondary hover:underline"
            @click="abrirCategorias(modalidade.id)"
          >
            {{ modalidadeAbertaId === modalidade.id ? 'Ocultar categorias' : `Categorias (${modalidade.categorias.length})` }}
          </button>

          <div v-if="modalidadeAbertaId === modalidade.id" class="mt-3 flex flex-col gap-2">
            <div
              v-for="categoria in modalidade.categorias"
              :key="categoria.id"
              class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
            >
              <span class="flex items-center gap-2">
                {{ categoria.nome }} · {{ faixaEtaria(categoria.idadeMinima, categoria.idadeMaxima) }} · {{ categoria.genero }}
                <span
                  v-if="categoria.pcd"
                  class="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary"
                >
                  PCD
                </span>
              </span>
              <button
                type="button"
                class="text-xs font-bold uppercase tracking-wide text-red-600 hover:text-red-700"
                @click="onRemoverCategoria(modalidade.id, categoria.id)"
              >
                Remover
              </button>
            </div>

            <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
              <input
                v-model="novaCategoria.nome"
                type="text"
                placeholder="Nome (ex.: 18-39)"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <input
                v-model="novaCategoria.idadeMinima"
                type="number"
                min="0"
                placeholder="Idade mín."
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <input
                v-model="novaCategoria.idadeMaxima"
                type="number"
                min="0"
                placeholder="Idade máx."
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
              <select
                v-model="novaCategoria.genero"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              >
                <option v-for="opcao in generoOpcoes" :key="opcao.valor" :value="opcao.valor">{{ opcao.label }}</option>
              </select>
            </div>
            <label class="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <input v-model="novaCategoria.pcd" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30" />
              Categoria PCD (pessoas com deficiência)
            </label>
            <button
              type="button"
              :disabled="salvando"
              class="self-start rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              @click="onCriarCategoria(modalidade.id)"
            >
              + Adicionar categoria
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-4">
      <button
        v-if="!mostrarFormModalidade"
        type="button"
        class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
        @click="mostrarFormModalidade = true"
      >
        + Nova modalidade
      </button>

      <div v-else class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            v-model="novaModalidade.nome"
            type="text"
            placeholder="Nome (ex.: 10km)"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            v-model="novaModalidade.distanciaKm"
            type="number"
            step="0.1"
            min="0.1"
            placeholder="Distância (km)"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            v-model="novaModalidade.idadeMinima"
            type="number"
            min="0"
            placeholder="Idade mín. (opcional)"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <input
            v-model="novaModalidade.idadeMaxima"
            type="number"
            min="0"
            placeholder="Idade máx. (opcional)"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <textarea
            v-model="novaModalidade.descricao"
            placeholder="Descrição (opcional)"
            rows="2"
            class="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          ></textarea>
        </div>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            :disabled="salvando"
            class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
            @click="onCriarModalidade"
          >
            {{ salvando ? 'Salvando...' : 'Salvar modalidade' }}
          </button>
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
            @click="mostrarFormModalidade = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
