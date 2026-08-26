<script setup lang="ts">
const { cliente, fetchMe, updatePessoaFisica, updatePessoaJuridica, updateEndereco } = useCliente()

const carregando = ref(true)
const erro = ref('')

const editandoDados = ref(false)
const editandoEndereco = ref(false)
const salvandoDados = ref(false)
const salvandoEndereco = ref(false)
const erroDados = ref('')
const erroEndereco = ref('')

const pfForm = reactive({
  nomeCompleto: '',
  cpf: '',
  dataNascimento: '',
  genero: '' as '' | 'MASCULINO' | 'FEMININO' | 'OUTRO',
  celular: '',
  nacionalidade: ''
})

const pjForm = reactive({
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  nomeResponsavel: '',
  documentoResponsavel: '',
  celularComercial: ''
})

const enderecoForm = reactive({
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  pais: 'Brasil'
})

const hoje = new Date().toISOString().slice(0, 10)

const generoOpcoes = [
  { valor: 'MASCULINO' as const, label: 'Masculino' },
  { valor: 'FEMININO' as const, label: 'Feminino' },
  { valor: 'OUTRO' as const, label: 'Outro' }
]

const generoLabel: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  OUTRO: 'Outro'
}

const estadosBr = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
]

onMounted(async () => {
  try {
    await fetchMe()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

function abrirEdicaoDados() {
  if (cliente.value?.pf) {
    pfForm.nomeCompleto = cliente.value.pf.nomeCompleto
    pfForm.cpf = cliente.value.pf.cpf
    pfForm.dataNascimento = cliente.value.pf.dataNascimento.slice(0, 10)
    pfForm.genero = cliente.value.pf.genero
    pfForm.celular = cliente.value.pf.celular
    pfForm.nacionalidade = cliente.value.pf.nacionalidade
  } else if (cliente.value?.pj) {
    pjForm.razaoSocial = cliente.value.pj.razaoSocial
    pjForm.nomeFantasia = cliente.value.pj.nomeFantasia || ''
    pjForm.cnpj = cliente.value.pj.cnpj
    pjForm.nomeResponsavel = cliente.value.pj.nomeResponsavel
    pjForm.documentoResponsavel = cliente.value.pj.documentoResponsavel
    pjForm.celularComercial = cliente.value.pj.celularComercial
  }
  erroDados.value = ''
  editandoDados.value = true
}

function abrirEdicaoEndereco() {
  const end = cliente.value?.enderecos?.[0]
  enderecoForm.cep = end?.cep || ''
  enderecoForm.logradouro = end?.logradouro || ''
  enderecoForm.numero = end?.numero || ''
  enderecoForm.complemento = end?.complemento || ''
  enderecoForm.bairro = end?.bairro || ''
  enderecoForm.cidade = end?.cidade || ''
  enderecoForm.estado = end?.estado || ''
  enderecoForm.pais = end?.pais || 'Brasil'
  erroEndereco.value = ''
  editandoEndereco.value = true
}

function formatarCpf(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  pfForm.cpf = v
}

function formatarCnpj(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 14)
  v = v.replace(/(\d{2})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1/$2')
  v = v.replace(/(\d{4})(\d{1,2})$/, '$1-$2')
  pjForm.cnpj = v
}

function formatarCelular(e: Event, alvo: 'pf' | 'pj') {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{2})(\d)/, '($1) $2')
  v = v.replace(/(\d{5})(\d{4})$/, '$1-$2')
  if (alvo === 'pf') pfForm.celular = v
  else pjForm.celularComercial = v
}

function formatarCpfResponsavel(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  pjForm.documentoResponsavel = v
}

const buscandoCep = ref(false)

async function formatarCep(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 8)
  v = v.replace(/(\d{5})(\d)/, '$1-$2')
  enderecoForm.cep = v

  if (v.replace(/\D/g, '').length === 8) {
    buscandoCep.value = true
    const endereco = await buscarEnderecoPorCep(v)
    buscandoCep.value = false
    if (endereco) {
      enderecoForm.logradouro = endereco.logradouro
      enderecoForm.bairro = endereco.bairro
      enderecoForm.cidade = endereco.cidade
      enderecoForm.estado = endereco.estado
    }
  }
}

async function salvarDados() {
  erroDados.value = ''
  salvandoDados.value = true
  try {
    if (cliente.value?.pf) {
      await updatePessoaFisica({ ...pfForm, genero: pfForm.genero as 'MASCULINO' | 'FEMININO' | 'OUTRO' })
    } else if (cliente.value?.pj) {
      await updatePessoaJuridica({ ...pjForm })
    }
    editandoDados.value = false
  } catch (e) {
    erroDados.value = extrairErro(e)
  } finally {
    salvandoDados.value = false
  }
}

async function salvarEndereco() {
  erroEndereco.value = ''
  if (!enderecoForm.estado) {
    erroEndereco.value = 'Selecione um estado.'
    return
  }
  salvandoEndereco.value = true
  try {
    await updateEndereco({ ...enderecoForm })
    editandoEndereco.value = false
  } catch (e) {
    erroEndereco.value = extrairErro(e)
  } finally {
    salvandoEndereco.value = false
  }
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Meus dados</h1>
    <p class="mt-1 text-sm text-slate-500">Dados cadastrais do organizador.</p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <p v-else-if="erro" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <template v-else>
      <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wide text-slate-400">
            {{ cliente?.pf ? 'Dados pessoais' : 'Dados da empresa' }}
          </h2>
          <button
            v-if="!editandoDados"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
            @click="abrirEdicaoDados"
          >
            Editar
          </button>
        </div>

        <p v-if="erroDados" class="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ erroDados }}
        </p>

        <dl v-if="!editandoDados && cliente?.pf" class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Nome completo</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pf.nomeCompleto }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">CPF</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pf.cpf }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Nascimento</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ formatarData(cliente.pf.dataNascimento) }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Gênero</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ generoLabel[cliente.pf.genero] || cliente.pf.genero }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Celular</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pf.celular }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Nacionalidade</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pf.nacionalidade }}</dd>
          </div>
        </dl>

        <dl v-else-if="!editandoDados && cliente?.pj" class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Razão social</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pj.razaoSocial }}</dd>
          </div>
          <div v-if="cliente.pj.nomeFantasia">
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Nome fantasia</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pj.nomeFantasia }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">CNPJ</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pj.cnpj }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Responsável</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pj.nomeResponsavel }} ({{ cliente.pj.documentoResponsavel }})</dd>
          </div>
          <div>
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">Celular comercial</dt>
            <dd class="mt-1 text-sm text-slate-700">{{ cliente.pj.celularComercial }}</dd>
          </div>
        </dl>

        <form v-else-if="editandoDados && cliente?.pf" class="mt-4 flex flex-col gap-4" @submit.prevent="salvarDados">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nome completo</label>
            <input v-model="pfForm.nomeCompleto" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">CPF</label>
              <input :value="pfForm.cpf" @input="formatarCpf" type="text" inputmode="numeric" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div class="min-w-0">
              <label class="mb-1 block text-sm font-semibold text-slate-700">Nascimento</label>
              <input v-model="pfForm.dataNascimento" type="date" :max="hoje" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Celular</label>
            <input :value="pfForm.celular" @input="(e) => formatarCelular(e, 'pf')" type="text" inputmode="numeric" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-semibold text-slate-700">Gênero</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="opcao in generoOpcoes"
                :key="opcao.valor"
                type="button"
                class="rounded-xl border px-3 py-2 text-sm font-medium transition"
                :class="pfForm.genero === opcao.valor ? 'border-accent bg-accent/10 text-primary' : 'border-slate-300 text-slate-600 hover:border-slate-400'"
                @click="pfForm.genero = opcao.valor"
              >
                {{ opcao.label }}
              </button>
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nacionalidade</label>
            <input v-model="pfForm.nacionalidade" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div class="flex gap-3">
            <button type="button" class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100" @click="editandoDados = false">Cancelar</button>
            <button type="submit" :disabled="salvandoDados" class="flex-1 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50">
              {{ salvandoDados ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>

        <form v-else-if="editandoDados && cliente?.pj" class="mt-4 flex flex-col gap-4" @submit.prevent="salvarDados">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Razão social</label>
            <input v-model="pjForm.razaoSocial" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nome fantasia (opcional)</label>
            <input v-model="pjForm.nomeFantasia" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">CNPJ</label>
            <input :value="pjForm.cnpj" @input="formatarCnpj" type="text" inputmode="numeric" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Nome do responsável</label>
              <input v-model="pjForm.nomeResponsavel" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">CPF do responsável</label>
              <input :value="pjForm.documentoResponsavel" @input="formatarCpfResponsavel" type="text" inputmode="numeric" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Celular comercial</label>
            <input :value="pjForm.celularComercial" @input="(e) => formatarCelular(e, 'pj')" type="text" inputmode="numeric" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div class="flex gap-3">
            <button type="button" class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100" @click="editandoDados = false">Cancelar</button>
            <button type="submit" :disabled="salvandoDados" class="flex-1 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50">
              {{ salvandoDados ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>
      </div>

      <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xs font-bold uppercase tracking-wide text-slate-400">Endereço</h2>
          <button
            v-if="!editandoEndereco"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
            @click="abrirEdicaoEndereco"
          >
            {{ cliente?.enderecos && cliente.enderecos.length > 0 ? 'Editar' : 'Adicionar' }}
          </button>
        </div>

        <template v-if="!editandoEndereco">
          <template v-if="cliente?.enderecos && cliente.enderecos.length > 0">
            <p class="mt-2 text-sm text-slate-700">
              {{ cliente.enderecos[0].logradouro }}, {{ cliente.enderecos[0].numero }}
              <template v-if="cliente.enderecos[0].complemento"> - {{ cliente.enderecos[0].complemento }}</template>
            </p>
            <p class="text-sm text-slate-700">
              {{ cliente.enderecos[0].bairro }} · {{ cliente.enderecos[0].cidade }}/{{ cliente.enderecos[0].estado }}
              · CEP {{ cliente.enderecos[0].cep }}
            </p>
          </template>
          <p v-else class="mt-2 text-sm text-slate-500">Nenhum endereço cadastrado ainda.</p>
        </template>

        <form v-else class="mt-4 flex flex-col gap-4" @submit.prevent="salvarEndereco">
          <p v-if="erroEndereco" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ erroEndereco }}
          </p>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">CEP</label>
              <input :value="enderecoForm.cep" @input="formatarCep" type="text" inputmode="numeric" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <p v-if="buscandoCep" class="mt-1 text-xs text-slate-400">Buscando endereço...</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Número</label>
              <input v-model="enderecoForm.numero" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Logradouro</label>
            <input v-model="enderecoForm.logradouro" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Complemento (opcional)</label>
            <input v-model="enderecoForm.complemento" type="text" class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Bairro</label>
            <input v-model="enderecoForm.bairro" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Cidade</label>
              <input v-model="enderecoForm.cidade" type="text" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">Estado</label>
              <select v-model="enderecoForm.estado" required class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30">
                <option value="" disabled>Selecione</option>
                <option v-for="uf in estadosBr" :key="uf.sigla" :value="uf.sigla">{{ uf.sigla }} - {{ uf.nome }}</option>
              </select>
            </div>
          </div>
          <div class="flex gap-3">
            <button type="button" class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100" @click="editandoEndereco = false">Cancelar</button>
            <button type="submit" :disabled="salvandoEndereco" class="flex-1 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50">
              {{ salvandoEndereco ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>
