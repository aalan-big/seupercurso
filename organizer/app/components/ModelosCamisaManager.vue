<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Shirt, Plus, Trash2, Edit2, Upload, Eye, Check, AlertCircle, Image as ImageIcon, X } from 'lucide-vue-next'
import type { ModeloCamisa } from '../composables/useEventoOrganizador'

const props = defineProps<{
  eventoId: string
}>()

const {
  listarModelosCamisa,
  criarModeloCamisa,
  atualizarModeloCamisa,
  removerModeloCamisa,
  uploadFotoModeloCamisa
} = useEventoOrganizador()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

const modelos = ref<ModeloCamisa[]>([])
const carregando = ref(true)
const salvando = ref(false)
const enviandoFoto = ref<{ id: string; tipo: 'frente' | 'verso' } | null>(null)
const erro = ref('')
const sucesso = ref('')

const modalAberto = ref(false)
const modeloEmEdicao = ref<ModeloCamisa | null>(null)
const form = ref({
  nome: '',
  descricao: '',
  ordem: 0,
  ativo: true
})

// Modal de visualização ampliada de foto
const fotoAmpliadaUrl = ref<string | null>(null)

function resolverUrl(caminho?: string | null) {
  if (!caminho) return ''
  return urlFoto(caminho, apiBase)
}

async function carregarModelos() {
  carregando.value = true
  erro.value = ''
  try {
    modelos.value = await listarModelosCamisa(props.eventoId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  carregarModelos()
})

function abrirModalNovo() {
  modeloEmEdicao.value = null
  form.value = {
    nome: '',
    descricao: '',
    ordem: modelos.value.length,
    ativo: true
  }
  modalAberto.value = true
}

function abrirModalEdicao(modelo: ModeloCamisa) {
  modeloEmEdicao.value = modelo
  form.value = {
    nome: modelo.nome,
    descricao: modelo.descricao || '',
    ordem: modelo.ordem,
    ativo: modelo.ativo
  }
  modalAberto.value = true
}

async function salvarModelo() {
  if (!form.value.nome.trim()) {
    erro.value = 'O nome do modelo de camisa é obrigatório.'
    return
  }

  salvando.value = true
  erro.value = ''
  sucesso.value = ''

  try {
    if (modeloEmEdicao.value) {
      await atualizarModeloCamisa(props.eventoId, modeloEmEdicao.value.id, {
        nome: form.value.nome.trim(),
        descricao: form.value.descricao.trim() || undefined,
        ordem: Number(form.value.ordem),
        ativo: form.value.ativo
      })
      sucesso.value = 'Modelo de camisa atualizado com sucesso!'
    } else {
      await criarModeloCamisa(props.eventoId, {
        nome: form.value.nome.trim(),
        descricao: form.value.descricao.trim() || undefined,
        ordem: Number(form.value.ordem),
        ativo: form.value.ativo
      })
      sucesso.value = 'Novo modelo de camisa criado com sucesso!'
    }
    modalAberto.value = false
    await carregarModelos()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onRemoverModelo(modelo: ModeloCamisa) {
  if (!confirm(`Deseja realmente excluir o modelo "${modelo.nome}"?`)) return

  try {
    await removerModeloCamisa(props.eventoId, modelo.id)
    sucesso.value = `Modelo "${modelo.nome}" removido.`
    await carregarModelos()
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

async function onAlternarAtivo(modelo: ModeloCamisa) {
  try {
    await atualizarModeloCamisa(props.eventoId, modelo.id, { ativo: !modelo.ativo })
    await carregarModelos()
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

async function onUploadFoto(modelo: ModeloCamisa, tipo: 'frente' | 'verso', event: Event) {
  const input = event.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo) return

  enviandoFoto.value = { id: modelo.id, tipo }
  erro.value = ''
  try {
    await uploadFotoModeloCamisa(props.eventoId, modelo.id, tipo, arquivo)
    await carregarModelos()
    sucesso.value = `Foto da ${tipo} do modelo "${modelo.nome}" atualizada!`
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    enviandoFoto.value = null
    input.value = ''
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h2 class="text-lg font-black text-slate-900 flex items-center gap-2">
          <Shirt class="w-5 h-5 text-orange-600" />
          Modelos de Camisa do Evento
        </h2>
        <p class="text-xs text-slate-500 mt-1">
          Cadastre os modelos de camisa disponíveis (ex: Tradicional, Baby Look, Regata) com fotos da frente e do verso para o atleta escolher na inscrição.
        </p>
      </div>

      <button
        type="button"
        @click="abrirModalNovo"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-orange-700 transition"
      >
        <Plus class="w-4 h-4" />
        Novo Modelo de Camisa
      </button>
    </div>

    <!-- Alertas -->
    <div v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 flex items-center gap-2">
      <AlertCircle class="w-4 h-4 shrink-0 text-red-600" />
      <span>{{ erro }}</span>
    </div>

    <div v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
      <Check class="w-4 h-4 shrink-0 text-emerald-600" />
      <span>{{ sucesso }}</span>
    </div>

    <!-- Estado de Carregamento -->
    <div v-if="carregando" class="text-center py-12 text-slate-400 text-xs font-semibold">
      Carregando modelos de camisa...
    </div>

    <!-- Estado Vazio -->
    <div
      v-else-if="modelos.length === 0"
      class="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 sm:p-12 text-center space-y-3"
    >
      <div class="w-12 h-12 rounded-full bg-orange-100 text-orange-600 mx-auto flex items-center justify-center">
        <Shirt class="w-6 h-6" />
      </div>
      <h3 class="font-extrabold text-slate-800 text-sm">Nenhum modelo personalizado cadastrado</h3>
      <p class="text-xs text-slate-500 max-w-md mx-auto">
        Se você não cadastrar modelos específicos, o evento continuará utilizando a grade padrão de tamanhos (PP, P, M, G, GG, XGG) sem escolha de modelo.
      </p>
      <button
        type="button"
        @click="abrirModalNovo"
        class="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-orange-600 hover:bg-orange-50 transition shadow-2xs"
      >
        <Plus class="w-3.5 h-3.5" />
        Adicionar Primeiro Modelo
      </button>
    </div>

    <!-- Lista de Modelos -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div
        v-for="modelo in modelos"
        :key="modelo.id"
        class="rounded-2xl border bg-white p-5 space-y-4 shadow-2xs transition"
        :class="modelo.ativo ? 'border-slate-200' : 'border-slate-200 bg-slate-50/60 opacity-70'"
      >
        <!-- Topo do Card -->
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-black text-slate-900 text-sm">{{ modelo.nome }}</h3>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                :class="modelo.ativo ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-200 text-slate-600'"
              >
                {{ modelo.ativo ? 'Ativo' : 'Inativo' }}
              </span>
            </div>
            <p v-if="modelo.descricao" class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ modelo.descricao }}</p>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="abrirModalEdicao(modelo)"
              class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Editar modelo"
            >
              <Edit2 class="w-4 h-4" />
            </button>
            <button
              type="button"
              @click="onRemoverModelo(modelo)"
              class="p-2 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
              title="Excluir modelo"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Grade de Fotos: Principal e Verso Opcional -->
        <div class="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <!-- Foto Principal / Cartaz -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 flex flex-col justify-between">
            <div class="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <div>
                <span>Foto Principal</span>
                <p class="text-[10px] text-slate-400 font-normal">Frente ou arte única</p>
              </div>
              <span v-if="modelo.fotoFrenteUrl" class="text-emerald-600 font-bold flex items-center gap-1">
                <Check class="w-3.5 h-3.5" />
                <span>Enviada</span>
              </span>
              <span v-else class="text-slate-400 font-normal">Pendente</span>
            </div>

            <div
              v-if="modelo.fotoFrenteUrl"
              class="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-200 bg-white group cursor-pointer"
              @click="fotoAmpliadaUrl = resolverUrl(modelo.fotoFrenteUrl)"
            >
              <img
                :src="resolverUrl(modelo.fotoFrenteUrl)"
                :alt="`Principal ${modelo.nome}`"
                class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-200"
              />
              <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                <Eye class="w-5 h-5" />
              </div>
            </div>

            <div v-else class="aspect-square w-full rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs text-center p-1">
              <ImageIcon class="w-5 h-5 mb-1 text-slate-300" />
              <span class="text-[10px] text-slate-400 leading-tight">Arte única ou frente</span>
            </div>

            <label
              class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition flex items-center justify-center gap-1.5 shadow-2xs"
              :class="{ 'opacity-60 pointer-events-none': enviandoFoto?.id === modelo.id && enviandoFoto?.tipo === 'frente' }"
            >
              <Upload class="w-3.5 h-3.5 text-slate-500" />
              <span>{{ enviandoFoto?.id === modelo.id && enviandoFoto?.tipo === 'frente' ? 'Enviando...' : (modelo.fotoFrenteUrl ? 'Trocar Foto' : 'Enviar Foto') }}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="onUploadFoto(modelo, 'frente', $event)"
              />
            </label>
          </div>

          <!-- Foto do Verso (Opcional) -->
          <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 flex flex-col justify-between">
            <div class="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <div>
                <span>Foto Verso</span>
                <p class="text-[10px] text-slate-400 font-normal">Opcional (costas)</p>
              </div>
              <span v-if="modelo.fotoVersoUrl" class="text-emerald-600 font-bold flex items-center gap-1">
                <Check class="w-3.5 h-3.5" />
                <span>Enviada</span>
              </span>
              <span v-else class="text-slate-400 font-normal">Opcional</span>
            </div>

            <div
              v-if="modelo.fotoVersoUrl"
              class="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-200 bg-white group cursor-pointer"
              @click="fotoAmpliadaUrl = resolverUrl(modelo.fotoVersoUrl)"
            >
              <img
                :src="resolverUrl(modelo.fotoVersoUrl)"
                :alt="`Verso ${modelo.nome}`"
                class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-200"
              />
              <div class="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                <Eye class="w-5 h-5" />
              </div>
            </div>

            <div v-else class="aspect-square w-full rounded-lg border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 text-xs text-center p-1">
              <ImageIcon class="w-5 h-5 mb-1 text-slate-300" />
              <span class="text-[10px] text-slate-400 leading-tight">Envie apenas se tiver foto separada</span>
            </div>

            <label
              class="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer transition flex items-center justify-center gap-1.5 shadow-2xs"
              :class="{ 'opacity-60 pointer-events-none': enviandoFoto?.id === modelo.id && enviandoFoto?.tipo === 'verso' }"
            >
              <Upload class="w-3.5 h-3.5 text-slate-500" />
              <span>{{ enviandoFoto?.id === modelo.id && enviandoFoto?.tipo === 'verso' ? 'Enviando...' : (modelo.fotoVersoUrl ? 'Trocar Verso' : 'Enviar Verso') }}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="hidden"
                @change="onUploadFoto(modelo, 'verso', $event)"
              />
            </label>
          </div>
        </div>

        <!-- Ação Rápida de Ativar/Desativar -->
        <div class="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
          <span class="text-[11px]">Ordem de exibição: {{ modelo.ordem }}</span>
          <button
            type="button"
            @click="onAlternarAtivo(modelo)"
            class="text-xs font-bold underline hover:text-slate-800"
          >
            {{ modelo.ativo ? 'Desativar este modelo' : 'Ativar este modelo' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Cadastro / Edição -->
    <Teleport to="body">
      <div
        v-if="modalAberto"
        class="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
        role="dialog"
      >
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
          <h3 class="text-base font-black text-slate-900 flex items-center gap-2">
            <Shirt class="w-5 h-5 text-orange-600" />
            {{ modeloEmEdicao ? 'Editar Modelo de Camisa' : 'Novo Modelo de Camisa' }}
          </h3>

          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Nome do Modelo *</label>
              <input
                v-model="form.nome"
                type="text"
                placeholder="Ex: Tradicional Manga Curta, Baby Look, Regata..."
                class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 mb-1">Descrição / Tecido (opcional)</label>
              <textarea
                v-model="form.descricao"
                rows="2"
                placeholder="Ex: 100% poliamida dry-fit, corte unissex, alta respirabilidade..."
                class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              ></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">Ordem de Exibição</label>
                <input
                  v-model.number="form.ordem"
                  type="number"
                  min="0"
                  class="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold focus:border-orange-500 focus:outline-none"
                />
                <p class="text-[10px] text-slate-400 mt-1">Ordem em que este modelo aparece para o atleta (ex: 1 = primeiro, 2 = segundo).</p>
              </div>

              <div class="flex items-center pt-5">
                <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input v-model="form.ativo" type="checkbox" class="h-4 w-4 rounded accent-orange-500" />
                  Modelo Ativo
                </label>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              @click="modalAberto = false"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="salvarModelo"
              :disabled="salvando"
              class="rounded-xl bg-orange-600 px-5 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-orange-700 disabled:opacity-50 transition"
            >
              {{ salvando ? 'Salvando...' : 'Salvar Modelo' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Modal de Visualização Ampliada da Foto -->
    <Teleport to="body">
      <div
        v-if="fotoAmpliadaUrl"
        class="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm cursor-pointer"
        @click="fotoAmpliadaUrl = null"
      >
        <div class="relative max-w-2xl max-h-[85vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden" @click.stop>
          <img :src="fotoAmpliadaUrl" alt="Foto ampliada da camisa" class="w-full h-full object-contain rounded-xl max-h-[80vh]" />
          <button
            type="button"
            @click="fotoAmpliadaUrl = null"
            class="absolute top-4 right-4 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full w-8 h-8 flex items-center justify-center transition cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
