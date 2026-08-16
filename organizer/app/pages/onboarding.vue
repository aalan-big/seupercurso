<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { token } = useAuth()
const { createPessoaFisica, createPessoaJuridica, createEndereco } = useCliente()
const { organizador, fetchMe: fetchOrganizadorMe, solicitarCadastro } = useOrganizador()

const verificando = ref(true)
const step = ref<1 | 2>(1)
const tipoPessoa = ref<'PF' | 'PJ'>('PJ')

const pfForm = reactive({
  nomeCompleto: '',
  cpf: '',
  dataNascimento: '',
  genero: '' as '' | 'MASCULINO' | 'FEMININO' | 'OUTRO',
  celular: '',
  nacionalidade: 'Brasileira'
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

const generoOpcoes = [
  { valor: 'MASCULINO' as const, label: 'Masculino' },
  { valor: 'FEMININO' as const, label: 'Feminino' },
  { valor: 'OUTRO' as const, label: 'Outro' }
]

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

const erro = ref('')
const carregando = ref(false)
const hoje = new Date().toISOString().slice(0, 10)

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login')
    return
  }

  try {
    await fetchOrganizadorMe()
    await navigateTo(organizador.value?.status === 'APROVADO' ? '/eventos' : '/aguardando-aprovacao')
    return
  } catch {
    // ainda não solicitou cadastro de organizador — segue pra tela de onboarding
  }

  verificando.value = false
})

function formatarCpf(e: Event, alvo: 'pf' | 'responsavel') {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  if (alvo === 'pf') pfForm.cpf = v
  else pjForm.documentoResponsavel = v
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

async function onSubmitDados() {
  erro.value = ''

  if (tipoPessoa.value === 'PF' && !pfForm.genero) {
    erro.value = 'Selecione um gênero.'
    return
  }

  carregando.value = true
  try {
    if (tipoPessoa.value === 'PF') {
      await createPessoaFisica({ ...pfForm, genero: pfForm.genero as 'MASCULINO' | 'FEMININO' | 'OUTRO' })
    } else {
      await createPessoaJuridica({ ...pjForm })
    }
    step.value = 2
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

async function onSubmitEndereco() {
  erro.value = ''

  if (!enderecoForm.estado) {
    erro.value = 'Selecione um estado.'
    return
  }

  carregando.value = true
  try {
    await createEndereco({ ...enderecoForm })
    await solicitarCadastro()
    await navigateTo('/aguardando-aprovacao')
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div v-if="!verificando">
    <div class="mb-6 flex items-center gap-2">
      <div
        class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
        :class="step >= 1 ? 'text-primary' : 'text-slate-400'"
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full"
          :class="step >= 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
        >
          1
        </span>
        Dados
      </div>
      <div class="h-0.5 flex-1" :class="step >= 2 ? 'bg-primary' : 'bg-slate-200'"></div>
      <div
        class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
        :class="step >= 2 ? 'text-primary' : 'text-slate-400'"
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full"
          :class="step >= 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
        >
          2
        </span>
        Endereço
      </div>
    </div>

    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">
      {{ step === 1 ? 'Solicitar cadastro de organizador' : 'Endereço' }}
    </h1>
    <p class="mt-1 text-sm text-slate-500">
      {{
        step === 1
          ? 'Precisamos confirmar quem é você antes de liberar a criação de eventos — sua conta vai lidar com pagamentos de inscrições.'
          : 'Usamos pra emitir nota fiscal e formalizar seus eventos.'
      }}
    </p>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <form v-if="step === 1" class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmitDados">
      <div class="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 text-sm font-bold uppercase tracking-wide">
        <button
          type="button"
          class="rounded-lg py-2 transition"
          :class="tipoPessoa === 'PJ' ? 'bg-white text-primary shadow' : 'text-slate-500'"
          @click="tipoPessoa = 'PJ'"
        >
          Empresa
        </button>
        <button
          type="button"
          class="rounded-lg py-2 transition"
          :class="tipoPessoa === 'PF' ? 'bg-white text-primary shadow' : 'text-slate-500'"
          @click="tipoPessoa = 'PF'"
        >
          Pessoa física
        </button>
      </div>

      <template v-if="tipoPessoa === 'PJ'">
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Razão social</label>
          <input
            v-model="pjForm.razaoSocial"
            type="text"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Nome fantasia (opcional)</label>
          <input
            v-model="pjForm.nomeFantasia"
            type="text"
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">CNPJ</label>
          <input
            :value="pjForm.cnpj"
            @input="formatarCnpj"
            type="text"
            inputmode="numeric"
            placeholder="00.000.000/0000-00"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nome do responsável</label>
            <input
              v-model="pjForm.nomeResponsavel"
              type="text"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">CPF do responsável</label>
            <input
              :value="pjForm.documentoResponsavel"
              @input="(e) => formatarCpf(e, 'responsavel')"
              type="text"
              inputmode="numeric"
              placeholder="000.000.000-00"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Celular comercial</label>
          <input
            :value="pjForm.celularComercial"
            @input="(e) => formatarCelular(e, 'pj')"
            type="text"
            inputmode="numeric"
            placeholder="(00) 00000-0000"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </template>

      <template v-else>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Nome completo</label>
          <input
            v-model="pfForm.nomeCompleto"
            type="text"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">CPF</label>
            <input
              :value="pfForm.cpf"
              @input="(e) => formatarCpf(e, 'pf')"
              type="text"
              inputmode="numeric"
              placeholder="000.000.000-00"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nascimento</label>
            <input
              v-model="pfForm.dataNascimento"
              type="date"
              :max="hoje"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Celular</label>
          <input
            :value="pfForm.celular"
            @input="(e) => formatarCelular(e, 'pf')"
            type="text"
            inputmode="numeric"
            placeholder="(00) 00000-0000"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label class="mb-2 block text-sm font-semibold text-slate-700">Gênero</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="opcao in generoOpcoes"
              :key="opcao.valor"
              type="button"
              class="rounded-xl border px-3 py-2 text-sm font-medium transition"
              :class="
                pfForm.genero === opcao.valor
                  ? 'border-accent bg-accent/10 text-primary'
                  : 'border-slate-300 text-slate-600 hover:border-slate-400'
              "
              @click="pfForm.genero = opcao.valor"
            >
              {{ opcao.label }}
            </button>
          </div>
        </div>
      </template>

      <button
        type="submit"
        :disabled="carregando"
        class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
      >
        {{ carregando ? 'Salvando...' : 'Continuar' }}
      </button>
    </form>

    <form v-else class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmitEndereco">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">CEP</label>
          <input
            :value="enderecoForm.cep"
            @input="formatarCep"
            type="text"
            inputmode="numeric"
            placeholder="00000-000"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <p v-if="buscandoCep" class="mt-1 text-xs text-slate-400">Buscando endereço...</p>
        </div>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Número</label>
          <input
            v-model="enderecoForm.numero"
            type="text"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Logradouro</label>
        <input
          v-model="enderecoForm.logradouro"
          type="text"
          placeholder="Rua, avenida..."
          required
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Complemento (opcional)</label>
        <input
          v-model="enderecoForm.complemento"
          type="text"
          placeholder="Sala, andar..."
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Bairro</label>
        <input
          v-model="enderecoForm.bairro"
          type="text"
          required
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Cidade</label>
          <input
            v-model="enderecoForm.cidade"
            type="text"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-semibold text-slate-700">Estado</label>
          <select
            v-model="enderecoForm.estado"
            required
            class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="" disabled>Selecione</option>
            <option v-for="uf in estadosBr" :key="uf.sigla" :value="uf.sigla">{{ uf.sigla }} - {{ uf.nome }}</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        :disabled="carregando"
        class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
      >
        {{ carregando ? 'Enviando...' : 'Enviar solicitação' }}
      </button>
    </form>
  </div>
</template>
