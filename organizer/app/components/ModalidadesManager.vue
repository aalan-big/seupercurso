<script setup lang="ts">
import { Footprints, Plus, Accessibility, Pencil } from 'lucide-vue-next'
import type { ModalidadeOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{
  eventoId: string
  cidade: string
  estado: string
  modalidades: ModalidadeOrganizador[]
}>()

const { criarModalidade, atualizarModalidade, removerModalidade, criarCategoria, atualizarCategoria, removerCategoria } =
  useEventoOrganizador()

const generoOpcoes = [
  { valor: 'LIVRE' as const, label: 'Livre' },
  { valor: 'MASCULINO' as const, label: 'Masculino' },
  { valor: 'FEMININO' as const, label: 'Feminino' }
]

const erro = ref('')
const salvando = ref(false)

const mostrarFormModalidade = ref(false)
const novaModalidade = reactive({ nome: '', distanciaKm: '', descricao: '', idadeMinima: '', idadeMaxima: '', capacidade: '' })

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
      idadeMaxima: novaModalidade.idadeMaxima ? Number(novaModalidade.idadeMaxima) : undefined,
      capacidade: novaModalidade.capacidade ? Number(novaModalidade.capacidade) : undefined
    })
    novaModalidade.nome = ''
    novaModalidade.distanciaKm = ''
    novaModalidade.descricao = ''
    novaModalidade.idadeMinima = ''
    novaModalidade.idadeMaxima = ''
    novaModalidade.capacidade = ''
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
const edicaoModalidade = reactive({ nome: '', distanciaKm: '', descricao: '', idadeMinima: '', idadeMaxima: '', capacidade: '' })

function abrirEdicao(modalidade: ModalidadeOrganizador) {
  modalidadeEditandoId.value = modalidade.id
  edicaoModalidade.nome = modalidade.nome
  edicaoModalidade.distanciaKm = modalidade.distanciaKm
  edicaoModalidade.descricao = modalidade.descricao || ''
  edicaoModalidade.idadeMinima = modalidade.idadeMinima ? String(modalidade.idadeMinima) : ''
  edicaoModalidade.idadeMaxima = modalidade.idadeMaxima ? String(modalidade.idadeMaxima) : ''
  edicaoModalidade.capacidade = modalidade.capacidade ? String(modalidade.capacidade) : ''
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
      idadeMaxima: edicaoModalidade.idadeMaxima ? Number(edicaoModalidade.idadeMaxima) : undefined,
      capacidade: edicaoModalidade.capacidade ? Number(edicaoModalidade.capacidade) : null
    })
    modalidadeEditandoId.value = null
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

const modalidadeAbertaId = ref<string | null>(null)
const modalidadeMapaAbertaId = ref<string | null>(null)

function abrirMapa(modalidadeId: string) {
  modalidadeMapaAbertaId.value = modalidadeMapaAbertaId.value === modalidadeId ? null : modalidadeId
}
const novaCategoria = reactive({ nome: '', idadeMinima: '', idadeMaxima: '', genero: 'LIVRE' as const, pcd: false, capacidade: '' })

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
      pcd: novaCategoria.pcd,
      capacidade: novaCategoria.capacidade ? Number(novaCategoria.capacidade) : undefined
    })
    novaCategoria.nome = ''
    novaCategoria.pcd = false
    novaCategoria.idadeMinima = ''
    novaCategoria.idadeMaxima = ''
    novaCategoria.genero = 'LIVRE'
    novaCategoria.capacidade = ''
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

const categoriaEditandoVagasId = ref<string | null>(null)
const vagasEditando = ref('')

function abrirEdicaoVagas(categoria: { id: string; capacidade: number | null }) {
  categoriaEditandoVagasId.value = categoria.id
  vagasEditando.value = categoria.capacidade ? String(categoria.capacidade) : ''
}

async function onSalvarVagas(modalidadeId: string, categoriaId: string) {
  erro.value = ''
  salvando.value = true
  try {
    await atualizarCategoria(props.eventoId, modalidadeId, categoriaId, {
      capacidade: vagasEditando.value ? Number(vagasEditando.value) : null
    })
    categoriaEditandoVagasId.value = null
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

async function onCriarCategoriasPcdPadrao(modalidadeId: string) {
  erro.value = ''
  salvando.value = true
  try {
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: 'PCD - Geral',
      genero: 'LIVRE',
      pcd: true
    })
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: 'PCD - Cadeirantes',
      genero: 'LIVRE',
      pcd: true
    })
    await criarCategoria(props.eventoId, modalidadeId, {
      nome: 'PCD - Deficiente Visual',
      genero: 'LIVRE',
      pcd: true
    })
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

function preencherPreset(nome: string, distanciaKm: string, descricao?: string) {
  novaModalidade.nome = nome
  novaModalidade.distanciaKm = distanciaKm
  novaModalidade.descricao = descricao || ''
}

const sugestoesModalidades = [
  { nome: 'Corrida', km: '5' },
  { nome: 'Caminhada', km: '3' },
  { nome: 'Meia Maratona', km: '21' },
  { nome: 'Maratona', km: '42' },
  { nome: 'MTB Pro', km: '50' },
  { nome: 'MTB Sport', km: '25' },
  { nome: 'Ciclismo Estrada', km: '80' },
  { nome: 'Motocross MX1', km: '12' },
  { nome: 'Motocross MX2', km: '10' },
  { nome: 'Enduro Pro', km: '40' },
  { nome: 'Veloterra Nacional', km: '8' },
  { nome: 'Natação Mar Aberto', km: '1.5' },
  { nome: 'Triathlon Sprint', km: '25.75' },
  { nome: 'PCD', km: '5' }
]

const menuSugestoesAberto = ref(false)

const sugestoesFiltradas = computed(() => {
  const busca = novaModalidade.nome.trim().toLowerCase()
  if (!busca) return sugestoesModalidades
  return sugestoesModalidades.filter((s) => s.nome.toLowerCase().includes(busca))
})

function selecionarSugestao(sug: { nome: string; km: string }) {
  novaModalidade.nome = sug.nome
  if (!novaModalidade.distanciaKm) {
    novaModalidade.distanciaKm = sug.km
  }
  menuSugestoesAberto.value = false
}

function fecharMenuComDelay() {
  setTimeout(() => {
    menuSugestoesAberto.value = false
  }, 200)
}

function faixaEtaria(min: number | null, max: number | null) {
  if (!min && !max) return 'Todas as idades'
  if (min && max) return `${min} a ${max} anos`
  if (min) return `A partir de ${min} anos`
  return `Até ${max} anos`
}
</script>

<template>
  <div class="space-y-4">
    <p v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
      <AppIcon name="warning" size="16" class="inline mr-1" /> {{ erro }}
    </p>

    <!-- Estado Vazio -->
    <div v-if="modalidades.length === 0" class="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-3 shadow-xs">
      <div class="h-12 w-12 rounded-2xl bg-amber-50 text-warning flex items-center justify-center mx-auto">
        <AppIcon name="eventos" size="24" />
      </div>
      <h3 class="font-bold text-sm text-slate-800">Nenhuma modalidade cadastrada</h3>
      <p class="text-xs text-slate-500 max-w-sm mx-auto">
        Adicione os percursos da sua prova (ex.: Corrida 5km, Caminhada 3km, 21km Meia Maratona) para liberar a criação de lotes de inscrição.
      </p>
    </div>

    <!-- Lista de Modalidades -->
    <div v-else class="flex flex-col gap-4">
      <div
        v-for="modalidade in modalidades"
        :key="modalidade.id"
        class="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden transition hover:border-slate-300"
      >
        <!-- Form de Edição da Modalidade -->
        <div v-if="modalidadeEditandoId === modalidade.id" class="p-4 sm:p-5 bg-slate-50/50 space-y-3">
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-700">Editar Modalidade</h4>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Nome da Modalidade</label>
              <input
                v-model="edicaoModalidade.nome"
                type="text"
                placeholder="Ex.: Corrida 10km"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Distância (km)</label>
              <input
                v-model="edicaoModalidade.distanciaKm"
                type="number"
                step="0.1"
                min="0.1"
                placeholder="Ex.: 10"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Idade Mínima</label>
              <input
                v-model="edicaoModalidade.idadeMinima"
                type="number"
                min="0"
                placeholder="Opcional"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Idade Máxima</label>
              <input
                v-model="edicaoModalidade.idadeMaxima"
                type="number"
                min="0"
                placeholder="Opcional"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Vagas do Percurso</label>
              <input
                v-model="edicaoModalidade.capacidade"
                type="number"
                min="1"
                placeholder="Sem limite"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-warning focus:outline-none"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Descrição do Percurso</label>
              <textarea
                v-model="edicaoModalidade.descricao"
                placeholder="Detalhes adicionais (opcional)"
                rows="2"
                class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
              ></textarea>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button
              type="button"
              :disabled="salvando"
              class="rounded-xl bg-warning px-5 py-2.5 text-xs font-black uppercase tracking-wider text-primary transition hover:brightness-95 disabled:opacity-50 flex items-center gap-1.5"
              @click="onSalvarEdicao(modalidade.id)"
            >
              <AppIcon name="check" size="14" /> {{ salvando ? 'Salvando...' : 'Salvar Alterações' }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              @click="cancelarEdicao"
            >
              Cancelar
            </button>
          </div>
        </div>

        <!-- Cabeçalho do Card da Modalidade (Mobile Friendly) -->
        <div v-else class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950 uppercase tracking-wider flex items-center gap-1">
                <Footprints :size="14" class="text-amber-950" /> {{ modalidade.distanciaKm }} km
              </span>
              <h3 class="font-extrabold text-base text-slate-900">{{ modalidade.nome }}</h3>
            </div>
            <p class="text-xs text-slate-500 font-medium">
              Faixa etária geral: <strong>{{ faixaEtaria(modalidade.idadeMinima, modalidade.idadeMaxima) }}</strong>
            </p>
            <p class="text-xs text-slate-500 font-medium">
              Vagas do percurso: <strong>{{ modalidade.capacidade ?? 'Sem limite' }}</strong>
            </p>
          </div>

          <div class="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-between sm:justify-end">
            <button
              type="button"
              class="rounded-xl px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide transition flex items-center gap-1"
              :class="modalidade.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'"
              @click="onToggleAtivo(modalidade)"
            >
              <AppIcon name="check" size="12" /> {{ modalidade.ativo ? 'Ativa' : 'Inativa' }}
            </button>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 transition flex items-center gap-1"
                @click="abrirEdicao(modalidade)"
              >
                Editar
              </button>
              <button
                type="button"
                class="rounded-xl bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-600 transition flex items-center gap-1"
                @click="onRemoverModalidade(modalidade.id)"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>

        <!-- Seção Expansível de Categorias -->
        <div class="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-5 sm:py-4">
          <div class="flex items-center justify-between">
            <button
              type="button"
              class="text-xs font-black uppercase tracking-wider text-slate-700 hover:text-primary flex items-center gap-1.5"
              @click="abrirCategorias(modalidade.id)"
            >
              <span>Categorias Especificas ({{ modalidade.categorias.length }})</span>
              <AppIcon name="chevron" size="14" :class="modalidadeAbertaId === modalidade.id ? 'rotate-180 transition' : 'transition'" />
            </button>
          </div>

          <div v-if="modalidadeAbertaId === modalidade.id" class="mt-4 space-y-4">
            <div v-if="modalidade.categorias.length === 0" class="text-xs italic text-slate-400">
              Nenhuma categoria específica cadastrada para esta modalidade.
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="categoria in modalidade.categorias"
                :key="categoria.id"
                class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xs"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="font-extrabold text-slate-800">{{ categoria.nome }}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">
                      {{ faixaEtaria(categoria.idadeMinima, categoria.idadeMaxima) }} · {{ categoria.genero }}
                      <span v-if="categoria.pcd" class="ml-1 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">PCD</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    class="text-red-500 hover:text-red-700 font-bold p-1"
                    title="Remover Categoria"
                    @click="onRemoverCategoria(modalidade.id, categoria.id)"
                  >
                    <AppIcon name="close" size="14" />
                  </button>
                </div>

                <div class="flex items-center justify-between border-t border-slate-100 pt-2">
                  <template v-if="categoriaEditandoVagasId === categoria.id">
                    <div class="flex items-center gap-1.5">
                      <input
                        v-model="vagasEditando"
                        type="number"
                        min="1"
                        placeholder="Sem limite"
                        class="w-24 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold focus:border-warning focus:outline-none"
                      />
                      <button
                        type="button"
                        :disabled="salvando"
                        class="rounded-lg bg-warning px-2 py-1 text-[10px] font-black uppercase text-primary hover:brightness-95 disabled:opacity-50"
                        @click="onSalvarVagas(modalidade.id, categoria.id)"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        class="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                        @click="categoriaEditandoVagasId = null"
                      >
                        Cancelar
                      </button>
                    </div>
                  </template>
                  <button
                    v-else
                    type="button"
                    class="text-[11px] font-bold text-slate-500 hover:text-primary flex items-center gap-1"
                    @click="abrirEdicaoVagas(categoria)"
                  >
                    Vagas: <span class="font-black text-slate-800">{{ categoria.capacidade ?? 'Sem limite' }}</span>
                    <Pencil :size="11" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Form de Adicionar Nova Categoria -->
            <div class="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h5 class="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <Plus :size="14" class="text-slate-700" /> <span>Adicionar Categoria para {{ modalidade.nome }}</span>
                </h5>
                <button
                  type="button"
                  :disabled="salvando"
                  class="rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 text-xs font-extrabold text-indigo-700 transition flex items-center gap-1 self-start sm:self-auto"
                  @click="onCriarCategoriasPcdPadrao(modalidade.id)"
                >
                  <Accessibility :size="14" class="text-indigo-700" /> <span>+ Auto-Criar Categorias PCD Padrão</span>
                </button>
              </div>

              <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-5">
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nome</label>
                  <input
                    v-model="novaCategoria.nome"
                    type="text"
                    placeholder="Ex.: PCD Geral ou 18 a 29 Anos"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Idade Mín.</label>
                  <input
                    v-model="novaCategoria.idadeMinima"
                    type="number"
                    min="0"
                    placeholder="Ex.: 18"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Idade Máx.</label>
                  <input
                    v-model="novaCategoria.idadeMaxima"
                    type="number"
                    min="0"
                    placeholder="Ex.: 29"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Gênero</label>
                  <select
                    v-model="novaCategoria.genero"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none bg-white"
                  >
                    <option v-for="opcao in generoOpcoes" :key="opcao.valor" :value="opcao.valor">{{ opcao.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Vagas (opcional)</label>
                  <input
                    v-model="novaCategoria.capacidade"
                    type="number"
                    min="1"
                    placeholder="Sem limite"
                    class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-warning focus:outline-none"
                  />
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <label class="flex items-center gap-2 text-xs font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 cursor-pointer transition hover:bg-indigo-100">
                  <input v-model="novaCategoria.pcd" type="checkbox" class="h-4 w-4 rounded accent-indigo-600" />
                  <Accessibility :size="14" class="text-indigo-700" /> <span>Marcar Categoria PCD (Pessoas com Deficiência)</span>
                </label>

                <button
                  type="button"
                  :disabled="salvando || !novaCategoria.nome"
                  class="w-full sm:w-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-xs hover:bg-primary disabled:opacity-50 transition"
                  @click="onCriarCategoria(modalidade.id)"
                >
                  + Salvar Categoria
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Seção Expansível de Percurso/Mapa -->
        <div class="border-t border-slate-100 bg-slate-50/50 p-4 sm:px-5 sm:py-4">
          <button
            type="button"
            class="text-xs font-black uppercase tracking-wider text-slate-700 hover:text-primary flex items-center gap-1.5"
            @click="abrirMapa(modalidade.id)"
          >
            <span>Percurso / Mapa {{ modalidade.rotaGeoJson || modalidade.mapaEmbedUrl || modalidade.mapaPercursoUrl ? '✓' : '' }}</span>
            <AppIcon name="chevron" size="14" :class="modalidadeMapaAbertaId === modalidade.id ? 'rotate-180 transition' : 'transition'" />
          </button>

          <div v-if="modalidadeMapaAbertaId === modalidade.id" class="mt-4">
            <ModalidadeMapa :evento-id="eventoId" :cidade="cidade" :estado="estado" :modalidade="modalidade" />
          </div>
        </div>
      </div>
    </div>

    <!-- Botão de Nova Modalidade -->
    <div class="pt-2">
      <button
        v-if="!mostrarFormModalidade"
        type="button"
        class="w-full sm:w-auto rounded-2xl bg-warning px-5 py-3 text-xs font-black uppercase tracking-wider text-primary shadow hover:brightness-95 transition flex items-center justify-center gap-2"
        @click="mostrarFormModalidade = true"
      >
        <AppIcon name="eventos" size="16" /> + Adicionar Nova Modalidade
      </button>

      <div v-else class="rounded-3xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Footprints :size="16" class="text-slate-800" /> Cadastrar Novo Percurso / Modalidade da Prova
          </h4>
        </div>


        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="relative">
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Nome da Modalidade *</label>
            <input
              v-model="novaModalidade.nome"
              type="text"
              placeholder="Ex.: Corrida, MTB Pro, Caminhada..."
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
              @focus="menuSugestoesAberto = true"
              @input="menuSugestoesAberto = true"
              @blur="fecharMenuComDelay"
            />

            <!-- Menu de sugestões posicionado EXATAMENTE abaixo do campo -->
            <div
              v-if="menuSugestoesAberto && sugestoesFiltradas.length > 0"
              class="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <button
                v-for="sug in sugestoesFiltradas"
                :key="sug.nome"
                type="button"
                class="w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-slate-700 transition hover:bg-amber-50 hover:text-amber-950 flex items-center justify-between"
                @mousedown.prevent="selecionarSugestao(sug)"
              >
                <span>{{ sug.nome }}</span>
                <span class="text-[10px] text-slate-400 font-normal">Sugerir {{ sug.km }}km</span>
              </button>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Distância (em km) *</label>
            <input
              v-model="novaModalidade.distanciaKm"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Ex.: 10"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Idade Mínima Permitida</label>
            <input
              v-model="novaModalidade.idadeMinima"
              type="number"
              min="0"
              placeholder="Ex.: 16 (Opcional)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Idade Máxima Permitida</label>
            <input
              v-model="novaModalidade.idadeMaxima"
              type="number"
              min="0"
              placeholder="Ex.: 80 (Opcional)"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Vagas do Percurso (opcional)</label>
            <input
              v-model="novaModalidade.capacidade"
              type="number"
              min="1"
              placeholder="Sem limite"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div class="sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Descrição Breve do Percurso</label>
            <textarea
              v-model="novaModalidade.descricao"
              placeholder="Descrição do percurso ou altimetria (opcional)"
              rows="2"
              class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold focus:border-amber-500 focus:outline-none"
            ></textarea>
          </div>
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button
            type="button"
            :disabled="salvando || !novaModalidade.nome || !novaModalidade.distanciaKm"
            class="rounded-xl bg-warning px-6 py-3 text-xs font-black uppercase tracking-wider text-primary shadow hover:brightness-95 disabled:opacity-50 flex items-center gap-1.5"
            @click="onCriarModalidade"
          >
            <AppIcon name="check" size="14" /> {{ salvando ? 'Salvando...' : 'Salvar Modalidade' }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
            @click="mostrarFormModalidade = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
