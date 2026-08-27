<script setup lang="ts">
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  UserCheck,
  AlertCircle,
  ArrowLeft
} from 'lucide-vue-next'

const { token } = useAuth()
const {
  dependentes,
  carregando,
  fetchDependentes,
  criarDependente,
  atualizarDependente,
  excluirDependente
} = useDependente()

const modalAberto = ref(false)
const modoEdicao = ref(false)
const idEdicao = ref<string | null>(null)
const salvando = ref(false)
const erro = ref('')
const sucessoMsg = ref('')

const form = reactive({
  nomeCompleto: '',
  cpf: '',
  dataNascimento: '',
  genero: 'MASCULINO' as 'MASCULINO' | 'FEMININO' | 'OUTRO',
  pcd: false,
  celular: ''
})

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login?redirect=/perfil/dependentes')
    return
  }
  try {
    await fetchDependentes()
  } catch (e: any) {
    erro.value = extrairErro(e)
  }
})

function abrirModalNovo() {
  erro.value = ''
  modoEdicao.value = false
  idEdicao.value = null
  form.nomeCompleto = ''
  form.cpf = ''
  form.dataNascimento = ''
  form.genero = 'MASCULINO'
  form.pcd = false
  form.celular = ''
  modalAberto.value = true
}

function abrirModalEditar(dep: any) {
  erro.value = ''
  modoEdicao.value = true
  idEdicao.value = dep.id
  form.nomeCompleto = dep.nomeCompleto
  form.cpf = dep.cpf
  form.dataNascimento = dep.dataNascimento ? dep.dataNascimento.split('T')[0] : ''
  form.genero = dep.genero
  form.pcd = dep.pcd
  form.celular = dep.celular || ''
  modalAberto.value = true
}

async function salvar() {
  erro.value = ''
  sucessoMsg.value = ''
  if (!form.nomeCompleto.trim() || !form.cpf.trim() || !form.dataNascimento) {
    erro.value = 'Preencha todos os campos obrigatórios (Nome, CPF e Data de Nascimento).'
    return
  }

  salvando.value = true
  try {
    if (modoEdicao.value && idEdicao.value) {
      await atualizarDependente(idEdicao.value, { ...form })
      sucessoMsg.value = 'Atleta dependente atualizado com sucesso!'
    } else {
      await criarDependente({ ...form })
      sucessoMsg.value = 'Atleta dependente cadastrado com sucesso!'
    }
    modalAberto.value = false
  } catch (e: any) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function deletar(dep: any) {
  if (!confirm(`Tem certeza que deseja excluir ${dep.nomeCompleto}?`)) return
  try {
    await excluirDependente(dep.id)
    sucessoMsg.value = 'Dependente removido com sucesso.'
  } catch (e: any) {
    alert(extrairErro(e))
  }
}

function formatarCpf(val: string) {
  if (!val) return ''
  const digits = val.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

function onInputCpf(e: Event) {
  const target = e.target as HTMLInputElement
  form.cpf = formatarCpf(target.value)
}

function formatarData(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800 py-6 sm:py-10 px-4 sm:px-6">
    <div class="max-w-4xl mx-auto space-y-6">

      <!-- Header & Voltar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div class="flex items-start gap-3">
          <NuxtLink
            to="/perfil"
            class="mt-0.5 shrink-0 p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition text-slate-600 shadow-sm"
          >
            <ArrowLeft class="w-5 h-5" />
          </NuxtLink>
          <div>
            <h1 class="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
              <Users class="w-6 h-6 text-orange-500 shrink-0" />
              <span>Meus Atletas / Dependentes</span>
            </h1>
            <p class="text-xs sm:text-sm text-slate-500 mt-1">
              Cadastre familiares ou parceiros de treino para fazer inscrições em lote.
            </p>
          </div>
        </div>

        <button
          @click="abrirModalNovo"
          class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm shrink-0"
        >
          <Plus class="w-4 h-4" />
          <span>Novo Atleta</span>
        </button>
      </div>

      <!-- Alertas -->
      <div v-if="sucessoMsg" class="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
        <Check class="w-5 h-5 flex-shrink-0 text-emerald-600" />
        <span>{{ sucessoMsg }}</span>
      </div>

      <div v-if="erro && !modalAberto" class="p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-center gap-2">
        <AlertCircle class="w-5 h-5 flex-shrink-0 text-red-600" />
        <span>{{ erro }}</span>
      </div>

      <!-- Loading -->
      <div v-if="carregando" class="py-12 text-center text-slate-400 space-y-3">
        <div class="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-semibold">Carregando seus atletas dependentes...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!dependentes || dependentes.length === 0" class="p-8 sm:p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div class="w-14 h-14 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto">
          <UserCheck class="w-7 h-7" />
        </div>
        <h3 class="text-base sm:text-lg font-extrabold text-slate-800">Nenhum atleta cadastrado ainda</h3>
        <p class="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Ao cadastrar seus dependentes ou parceiros de treino aqui, você conseguirá selecioná-los rapidamente nos eventos e pagar tudo em uma única cobrança.
        </p>
        <button
          @click="abrirModalNovo"
          class="inline-flex items-center justify-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm"
        >
          <Plus class="w-4 h-4" />
          <span>Cadastrar Primeiro Atleta</span>
        </button>
      </div>

      <!-- Lista de Dependentes -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="dep in dependentes"
          :key="dep.id"
          class="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-300 transition"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h3 class="font-extrabold text-base text-slate-900">{{ dep.nomeCompleto }}</h3>
                <p class="text-xs font-semibold text-slate-500 mt-0.5">CPF: {{ formatarCpf(dep.cpf) }}</p>
              </div>
              <span
                v-if="dep.pcd"
                class="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 rounded-full shrink-0"
              >
                PCD
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Nascimento</span>
                <span class="font-bold text-slate-800">{{ formatarData(dep.dataNascimento) }}</span>
              </div>
              <div>
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Gênero</span>
                <span class="font-bold text-slate-800 capitalize">{{ dep.genero.toLowerCase() }}</span>
              </div>
              <div v-if="dep.celular" class="col-span-2 pt-1 border-t border-slate-200/60 mt-1">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Celular</span>
                <span class="font-bold text-slate-800">{{ dep.celular }}</span>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              @click="abrirModalEditar(dep)"
              class="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Editar"
            >
              <Edit2 class="w-4 h-4" />
            </button>
            <button
              @click="deletar(dep)"
              class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
              title="Excluir"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Modal Form Novo / Editar -->
    <div
      v-if="modalAberto"
      class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div class="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 class="text-lg font-black uppercase text-slate-900 flex items-center gap-2">
            <Users class="w-5 h-5 text-orange-500" />
            <span>{{ modoEdicao ? 'Editar Atleta' : 'Novo Atleta' }}</span>
          </h2>
          <button @click="modalAberto = false" class="text-slate-400 hover:text-slate-600 p-1">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div v-if="erro" class="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
          {{ erro }}
        </div>

        <div class="space-y-4 text-xs">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Nome Completo *</label>
            <input
              v-model="form.nomeCompleto"
              type="text"
              placeholder="Ex: João da Silva"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:border-orange-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block font-bold text-slate-700 mb-1">CPF *</label>
              <input
                :value="form.cpf"
                @input="onInputCpf"
                type="text"
                inputmode="numeric"
                placeholder="000.000.000-00"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Data de Nascimento *</label>
              <input
                v-model="form.dataNascimento"
                type="date"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Gênero *</label>
              <select
                v-model="form.genero"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:border-orange-500 focus:bg-white focus:outline-none"
              >
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Celular (Opcional)</label>
              <input
                v-model="form.celular"
                type="text"
                placeholder="(85) 99999-9999"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 text-xs focus:border-orange-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div class="pt-1">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                v-model="form.pcd"
                class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              <span class="font-bold text-slate-700">Atleta Pessoa com Deficiência (PCD)</span>
            </label>
          </div>
        </div>

        <div class="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
          <button
            @click="modalAberto = false"
            class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase rounded-xl transition"
          >
            Cancelar
          </button>
          <button
            @click="salvar"
            :disabled="salvando"
            class="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition shadow-sm disabled:opacity-50"
          >
            {{ salvando ? 'Salvando...' : 'Salvar Atleta' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
