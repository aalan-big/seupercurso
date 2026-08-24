<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { token } = useAuth()
const { createPessoaFisica, createPessoaJuridica, createEndereco } = useCliente()
const { organizador, fetchMe: fetchOrganizadorMe, solicitarCadastro, uploadDocumentoIdentidade } = useOrganizador()

const verificando = ref(true)
const step = ref<1 | 2 | 3>(1)
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

const route = useRoute()

const { cliente, fetchMe: fetchClienteMe } = useCliente()

onMounted(async () => {
  if (route.query.token && typeof route.query.token === 'string') {
    token.value = route.query.token
  }

  if (!token.value) {
    await navigateTo('/login')
    return
  }

  try {
    await fetchOrganizadorMe()

    if (organizador.value?.status === 'APROVADO') {
      await navigateTo('/dashboard')
      return
    }

    if (organizador.value?.documentoIdentidadeUrl && organizador.value?.fotoRostoUrl) {
      await navigateTo('/aguardando-aprovacao')
      return
    }
  } catch {
    // ainda não solicitou organizador
  }

  // pré-carrega os dados do atleta na Etapa 1, mantendo a opção de escolher Empresa (PJ) ou Pessoa Física (PF)
  try {
    const clienteData = await fetchClienteMe()
    if (clienteData?.pf) {
      pfForm.nomeCompleto = clienteData.pf.nomeCompleto || ''
      pfForm.cpf = clienteData.pf.cpf || ''
      pfForm.celular = clienteData.pf.celular || ''
      if (clienteData.pf.dataNascimento) {
        pfForm.dataNascimento = new Date(clienteData.pf.dataNascimento).toISOString().split('T')[0]
      }
      if (clienteData.pf.genero) {
        pfForm.genero = clienteData.pf.genero
      }
      pjForm.nomeResponsavel = clienteData.pf.nomeCompleto || ''
      pjForm.documentoResponsavel = clienteData.pf.cpf || ''
      pjForm.celularComercial = clienteData.pf.celular || ''
    }
  } catch {
    // ok
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
    step.value = 3
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

const fotoRostoArquivo = ref<File | null>(null)
const documentoArquivo = ref<File | null>(null)

function onSelecionarFotoRosto(e: Event) {
  const input = e.target as HTMLInputElement
  fotoRostoArquivo.value = input.files?.[0] ?? null
}

function onSelecionarDocumento(e: Event) {
  const input = e.target as HTMLInputElement
  documentoArquivo.value = input.files?.[0] ?? null
}

async function onSubmitDocumento() {
  erro.value = ''

  if (!fotoRostoArquivo.value) {
    erro.value = 'Envie uma foto do seu rosto (selfie) para validação de identidade.'
    return
  }
  if (!documentoArquivo.value) {
    erro.value = 'Envie uma foto ou PDF do seu documento de identidade (RG ou CNH).'
    return
  }

  carregando.value = true
  try {
    await uploadFotoRosto(fotoRostoArquivo.value)
    await uploadDocumentoIdentidade(documentoArquivo.value)
    await navigateTo('/aguardando-aprovacao')
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

const mostrarQrMobile = ref(true)

const celularNumero = computed(() => {
  const cel = tipoPessoa.value === 'PF' ? pfForm.celular : pjForm.celularComercial
  return (cel || '').replace(/\D/g, '')
})

const celularFormatado = computed(() => {
  return (tipoPessoa.value === 'PF' ? pfForm.celular : pjForm.celularComercial) || 'celular cadastrado'
})

const currentUrl = computed(() => {
  if (typeof window === 'undefined') return ''
  const tokenStr = token.value ? `?token=${encodeURIComponent(token.value)}` : ''
  return `${window.location.origin}/onboarding${tokenStr}`
})

const qrCodeUrl = computed(() => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl.value)}`
})

const whatsappUrl = computed(() => {
  const num = celularNumero.value ? `55${celularNumero.value}` : ''
  const msg = `Olá! Clique no link a seguir para enviar a sua Selfie e os Documentos para verificação no SeuPercurso:\n\n${currentUrl.value}`
  return `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(msg)}`
})

const mostrarLiveness = ref(false)

function onFotoLivenessCapturada(file: File) {
  fotoRostoArquivo.value = file
  mostrarLiveness.value = false
}




</script>

<template>
  <div v-if="!verificando">
    <div class="mb-6 flex items-center gap-2">
      <button
        type="button"
        class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide cursor-pointer hover:opacity-80 transition"
        :class="step >= 1 ? 'text-primary' : 'text-slate-400'"
        @click="step = 1"
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full"
          :class="step >= 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
        >
          1
        </span>
        Dados
      </button>
      <div class="h-0.5 flex-1" :class="step >= 2 ? 'bg-primary' : 'bg-slate-200'"></div>
      <button
        type="button"
        class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide cursor-pointer hover:opacity-80 transition"
        :class="step >= 2 ? 'text-primary' : 'text-slate-400'"
        @click="step = 2"
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full"
          :class="step >= 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
        >
          2
        </span>
        Endereço
      </button>
      <div class="h-0.5 flex-1" :class="step >= 3 ? 'bg-primary' : 'bg-slate-200'"></div>
      <button
        type="button"
        class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide cursor-pointer hover:opacity-80 transition"
        :class="step >= 3 ? 'text-primary' : 'text-slate-400'"
        @click="step = 3"
      >
        <span
          class="flex h-6 w-6 items-center justify-center rounded-full"
          :class="step >= 3 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
        >
          3
        </span>
        Documento
      </button>
    </div>

    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">
      {{ step === 1 ? 'Solicitar cadastro de organizador' : step === 2 ? 'Endereço' : 'Documento de identidade' }}
    </h1>
    <p class="mt-1 text-sm text-slate-500">
      {{
        step === 1
          ? 'Precisamos confirmar quem é você antes de liberar a criação de eventos — sua conta vai lidar com pagamentos de inscrições.'
          : step === 2
            ? 'Usamos pra emitir nota fiscal e formalizar seus eventos.'
            : 'Envie uma foto ou PDF do seu RG ou CNH — nossa equipe confere antes de liberar sua conta, por segurança de quem vai se inscrever nos seus eventos.'
      }}
    </p>

    <button
      v-if="step === 3"
      type="button"
      class="mt-2 text-xs font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-1.5 transition"
      @click="step = 1"
    >
      <span>✏️</span> Deseja cadastrar como Empresa (CNPJ) ou alterar os dados iniciais? Clique aqui
    </button>


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

    <form v-else-if="step === 2" class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmitEndereco">
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
        {{ carregando ? 'Enviando...' : 'Continuar' }}
      </button>
    </form>

    <form v-else class="mt-6 flex flex-col gap-6" @submit.prevent="onSubmitDocumento">
      <!-- Card QR Code & WhatsApp para abrir no Celular (100% Grátis) - Apenas para usuários no PC -->
      <div class="hidden sm:block rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 space-y-4 shadow-xs">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <AppIcon name="camera" size="22" class="text-emerald-700" />
            <div>
              <h3 class="font-black text-sm text-emerald-950">Prefere tirar a selfie e fotos pelo Celular?</h3>
              <p class="text-xs text-emerald-800">Aponte a câmera do celular para o QR Code ou envie o link direto no WhatsApp.</p>
            </div>
          </div>
          <button
            type="button"
            class="text-xs font-bold text-emerald-900 underline hover:text-emerald-950 shrink-0"
            @click="mostrarQrMobile = !mostrarQrMobile"
          >
            {{ mostrarQrMobile ? 'Ocultar QR Code' : 'Exibir QR Code' }}
          </button>
        </div>

        <div v-if="mostrarQrMobile" class="flex flex-wrap items-center justify-center gap-6 pt-3 border-t border-emerald-200/80">
          <div class="bg-white p-3 rounded-2xl border border-emerald-200 shadow-xs text-center">
            <img :src="qrCodeUrl" alt="QR Code Validação Mobile" class="h-36 w-36 mx-auto rounded-lg" />
            <p class="mt-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aponte a câmera do celular</p>
          </div>

          <div class="space-y-3 max-w-xs text-center sm:text-left">
            <a
              :href="whatsappUrl"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <AppIcon name="whatsapp" size="16" /> Abrir no Meu WhatsApp
            </a>
            <p class="text-[11px] text-emerald-800 leading-tight">
              Link de validação formatado para o número <strong>{{ celularFormatado }}</strong>.
            </p>
          </div>
        </div>
      </div>

      <!-- 1. Foto do Rosto (Selfie) -->
      <div class="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
        <label class="block text-sm font-bold text-slate-800 flex items-center gap-2">
          <AppIcon name="user" size="16" class="text-indigo-600" /> 1. Foto do Rosto (Prova de Vida Ao Vivo)
        </label>
        <p class="text-xs text-slate-500">A foto do seu rosto deve ser capturada ao vivo pela câmera interativa para validação antifraude.</p>

        <button
          type="button"
          class="w-full rounded-xl bg-warning py-3.5 text-xs font-black uppercase tracking-wider text-primary shadow-md hover:brightness-95 transition flex items-center justify-center gap-2"
          @click="mostrarLiveness = true"
        >
          <AppIcon name="camera" size="16" class="text-primary" /> Tirar Selfie Ao Vivo (Prova de Vida 3D)
        </button>

        <p v-if="fotoRostoArquivo" class="text-xs font-bold text-emerald-600 text-center bg-emerald-50 py-2 rounded-xl border border-emerald-200 flex items-center justify-center gap-1">
          <AppIcon name="check" size="14" /> Selfie capturada com Prova de Vida: {{ fotoRostoArquivo.name }}
        </p>
      </div>

      <!-- 2. Documento Oficial (RG ou CNH) -->
      <div class="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
        <label class="block text-sm font-bold text-slate-800 flex items-center gap-2">
          <AppIcon name="documento" size="16" class="text-amber-600" /> 2. Documento Oficial (RG ou CNH)
        </label>
        <p class="text-xs text-slate-500">Envie foto legível da frente/verso do RG ou CNH (ou arquivo em PDF).</p>
        <input
          type="file"
          accept="image/*,application/pdf"
          required
          class="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-100 border border-slate-200 rounded-xl p-1"
          @change="onSelecionarDocumento"
        />
        <p v-if="documentoArquivo" class="text-xs font-bold text-emerald-600 flex items-center gap-1">
          <AppIcon name="check" size="14" /> Documento selecionado: {{ documentoArquivo.name }}
        </p>
      </div>

      <button
        type="submit"
        :disabled="carregando"
        class="mt-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white transition hover:bg-primary disabled:opacity-50"
      >
        {{ carregando ? 'Enviando documentos...' : 'Enviar solicitação completa' }}
      </button>
    </form>


    <!-- Componente de Prova de Vida 3D Ao Vivo -->
    <LivenessCamera
      v-if="mostrarLiveness"
      @capturado="onFotoLivenessCapturada"
      @fechar="mostrarLiveness = false"
    />
  </div>
</template>



