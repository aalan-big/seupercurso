<script setup lang="ts">
const { token, register } = useAuth()
const { createPessoaFisica, createEndereco, uploadDocumentoPcd, fetchMe } = useCliente()
const route = useRoute()

const destino = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
})

const step = ref(1)

const contaForm = reactive({ email: '', password: '', confirmarSenha: '' })
const atletaForm = reactive({
  nomeCompleto: '',
  cpf: '',
  dataNascimento: '',
  genero: '' as '' | 'MASCULINO' | 'FEMININO' | 'OUTRO',
  pcd: false,
  celular: '',
  nacionalidade: 'Brasileira'
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

const erro = ref('')
const carregando = ref(false)
const hoje = new Date().toISOString().slice(0, 10)

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

const fotos = ['/hero-corrida.jpg', '/hero-moto.jpg', '/hero-ciclismo.jpg']
const fotoAtual = ref(0)
let intervaloFotos: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  intervaloFotos = setInterval(() => {
    fotoAtual.value = (fotoAtual.value + 1) % fotos.length
  }, 4000)

  if (token.value) {
    try {
      const cliente = await fetchMe()
      if (cliente.enderecos && cliente.enderecos.length > 0) {
        await navigateTo(destino.value)
      } else {
        step.value = 3
      }
    } catch {
      step.value = 2
    }
  }
})

onUnmounted(() => {
  clearInterval(intervaloFotos)
})

function formatarCpf(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d)/, '$1.$2')
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  atletaForm.cpf = v
}

function formatarCelular(e: Event) {
  const input = e.target as HTMLInputElement
  let v = input.value.replace(/\D/g, '').slice(0, 11)
  v = v.replace(/(\d{2})(\d)/, '($1) $2')
  v = v.replace(/(\d{5})(\d{4})$/, '$1-$2')
  atletaForm.celular = v
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

async function onSubmitConta() {
  erro.value = ''

  if (contaForm.password.length < 8) {
    erro.value = 'A senha precisa ter no mínimo 8 caracteres.'
    return
  }
  if (contaForm.password !== contaForm.confirmarSenha) {
    erro.value = 'As senhas não coincidem.'
    return
  }

  carregando.value = true
  try {
    await register(contaForm.email, contaForm.password)
    step.value = 2
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

const documentoPcd = ref<File | null>(null)

function onSelecionarDocumentoPcd(e: Event) {
  const input = e.target as HTMLInputElement
  documentoPcd.value = input.files?.[0] || null
}

async function onSubmitAtleta() {
  erro.value = ''

  if (!atletaForm.genero) {
    erro.value = 'Selecione um gênero.'
    return
  }
  if (atletaForm.pcd && !documentoPcd.value) {
    erro.value = 'Envie um documento que comprove a condição de PCD.'
    return
  }

  carregando.value = true
  try {
    await createPessoaFisica({
      nomeCompleto: atletaForm.nomeCompleto,
      cpf: atletaForm.cpf,
      dataNascimento: atletaForm.dataNascimento,
      genero: atletaForm.genero,
      pcd: atletaForm.pcd,
      celular: atletaForm.celular,
      nacionalidade: atletaForm.nacionalidade
    })
    if (atletaForm.pcd && documentoPcd.value) {
      await uploadDocumentoPcd(documentoPcd.value)
    }
    step.value = 3
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
    await navigateTo(destino.value)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <div class="grid min-h-[85vh] grid-cols-1 md:grid-cols-2">
    <div class="relative hidden overflow-hidden md:block">
      <div
        v-for="(foto, i) in fotos"
        :key="foto"
        class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
        :class="i === fotoAtual ? 'opacity-100' : 'opacity-0'"
        :style="{ backgroundImage: `url(${foto})` }"
      ></div>
      <div class="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-secondary/70"></div>
      <div class="relative flex h-full flex-col justify-center px-12">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl backdrop-blur">
          🏃
        </span>
        <h2 class="mt-6 text-3xl font-extrabold uppercase leading-tight tracking-tight text-white">
          Junte-se aos<br />atletas do SeuPercurso
        </h2>
        <p class="mt-3 max-w-sm text-slate-200">
          Crie sua conta e comece a se inscrever nos melhores eventos esportivos do país.
        </p>
      </div>
    </div>

    <div class="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
      <div class="mx-auto w-full max-w-sm">
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
            Conta
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
            Atleta
          </div>
          <div class="h-0.5 flex-1" :class="step >= 3 ? 'bg-primary' : 'bg-slate-200'"></div>
          <div
            class="flex items-center gap-2 text-xs font-bold uppercase tracking-wide"
            :class="step >= 3 ? 'text-primary' : 'text-slate-400'"
          >
            <span
              class="flex h-6 w-6 items-center justify-center rounded-full"
              :class="step >= 3 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
            >
              3
            </span>
            Endereço
          </div>
        </div>

        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">
          {{ step === 1 ? 'Criar conta' : step === 2 ? 'Seus dados' : 'Seu endereço' }}
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          {{
            step === 1
              ? 'Cadastre-se pra acompanhar eventos e se inscrever em corridas.'
              : step === 2
                ? 'Precisamos desses dados pra confirmar sua inscrição nos eventos.'
                : 'Usamos pra emitir seu kit e nota fiscal das inscrições.'
          }}
        </p>

        <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ erro }}
        </p>

        <form v-if="step === 1" class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmitConta">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">E-mail</label>
            <input
              v-model="contaForm.email"
              type="email"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Senha</label>
            <input
              v-model="contaForm.password"
              type="password"
              required
              minlength="8"
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p class="mt-1 text-xs text-slate-400">Mínimo de 8 caracteres.</p>
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Confirmar senha</label>
            <input
              v-model="contaForm.confirmarSenha"
              type="password"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <button
            type="submit"
            :disabled="carregando"
            class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          >
            {{ carregando ? 'Criando conta...' : 'Continuar' }}
          </button>
        </form>

        <form v-else-if="step === 2" class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmitAtleta">
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nome completo</label>
            <input
              v-model="atletaForm.nomeCompleto"
              type="text"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">CPF</label>
              <input
                :value="atletaForm.cpf"
                @input="formatarCpf"
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
                v-model="atletaForm.dataNascimento"
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
              :value="atletaForm.celular"
              @input="formatarCelular"
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
                  atletaForm.genero === opcao.valor
                    ? 'border-accent bg-accent/10 text-primary'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400'
                "
                @click="atletaForm.genero = opcao.valor"
              >
                {{ opcao.label }}
              </button>
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="atletaForm.pcd" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent/30" />
            Sou pessoa com deficiência (PCD)
          </label>

          <div v-if="atletaForm.pcd">
            <label class="mb-1 block text-sm font-semibold text-slate-700">Documento que comprove a condição de PCD</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              class="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              @change="onSelecionarDocumentoPcd"
            />
            <p class="mt-1 text-xs text-slate-400">Laudo médico, cartão do CID ou outro documento oficial. Imagem ou PDF.</p>
          </div>

          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nacionalidade</label>
            <input
              v-model="atletaForm.nacionalidade"
              type="text"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          <button
            type="submit"
            :disabled="carregando"
            class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
          >
            {{ carregando ? 'Salvando...' : 'Continuar' }}
          </button>
        </form>

        <form v-else class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmitEndereco">
          <div class="grid grid-cols-2 gap-4">
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
              placeholder="Apto, bloco..."
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

          <div class="grid grid-cols-2 gap-4">
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
            {{ carregando ? 'Finalizando...' : 'Concluir cadastro' }}
          </button>
        </form>

        <p v-if="step === 1" class="mt-6 text-center text-sm text-slate-500">
          Já tem conta?
          <NuxtLink to="/login" class="font-semibold text-secondary hover:underline">Entrar</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>
