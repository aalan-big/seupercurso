<script setup lang="ts">
const { token, user } = useAuth()
const { cliente, fetchMe, updatePessoaFisica, updateEndereco, uploadFoto, uploadDocumentoPcd } = useCliente()
const config = useRuntimeConfig()
const organizerBase = config.public.organizerBase as string

const organizerLink = computed(() => {
  if (token.value) {
    return `${organizerBase}/onboarding?token=${encodeURIComponent(token.value)}`
  }
  return `${organizerBase}/cadastro`
})

const carregando = ref(true)


const erro = ref('')

const fotoInputRef = ref<HTMLInputElement | null>(null)
const enviandoFoto = ref(false)
const erroFoto = ref('')

const fotoUrl = computed(() => urlFoto(cliente.value?.fotoPerfil, config.public.apiBase as string))

function abrirSeletorFoto() {
  fotoInputRef.value?.click()
}

async function onFotoSelecionada(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo) return

  erroFoto.value = ''

  if (!arquivo.type.startsWith('image/')) {
    erroFoto.value = 'Envie um arquivo de imagem.'
    input.value = ''
    return
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    erroFoto.value = 'A imagem precisa ter até 5MB.'
    input.value = ''
    return
  }

  enviandoFoto.value = true
  try {
    await uploadFoto(arquivo)
  } catch (e) {
    erroFoto.value = extrairErro(e)
  } finally {
    enviandoFoto.value = false
    input.value = ''
  }
}

const editandoAtleta = ref(false)
const editandoEndereco = ref(false)
const salvandoAtleta = ref(false)
const salvandoEndereco = ref(false)
const erroAtleta = ref('')
const erroEndereco = ref('')

const atletaForm = reactive({
  nomeCompleto: '',
  cpf: '',
  dataNascimento: '',
  genero: '' as '' | 'MASCULINO' | 'FEMININO' | 'OUTRO',
  pcd: false,
  celular: '',
  nacionalidade: ''
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

const generoLabel: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  OUTRO: 'Outro'
}

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login?redirect=/perfil')
    return
  }
  try {
    await fetchMe()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function abrirEdicaoAtleta() {
  const pf = cliente.value?.pf
  atletaForm.nomeCompleto = pf?.nomeCompleto || ''
  atletaForm.cpf = pf?.cpf || ''
  atletaForm.dataNascimento = pf?.dataNascimento ? pf.dataNascimento.slice(0, 10) : ''
  atletaForm.genero = pf?.genero || ''
  atletaForm.pcd = pf?.pcd || false
  atletaForm.celular = pf?.celular || ''
  atletaForm.nacionalidade = pf?.nacionalidade || 'Brasileira'
  erroAtleta.value = ''
  editandoAtleta.value = true
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

const documentoPcd = ref<File | null>(null)

function onSelecionarDocumentoPcd(e: Event) {
  const input = e.target as HTMLInputElement
  documentoPcd.value = input.files?.[0] || null
}

async function salvarAtleta() {
  erroAtleta.value = ''

  const jaTemDocumento = !!cliente.value?.pf?.documentoPcdUrl
  if (atletaForm.pcd && !jaTemDocumento && !documentoPcd.value) {
    erroAtleta.value = 'Envie um documento que comprove a condição de PCD.'
    return
  }

  salvandoAtleta.value = true
  try {
    await updatePessoaFisica({ ...atletaForm })
    if (atletaForm.pcd && documentoPcd.value) {
      await uploadDocumentoPcd(documentoPcd.value)
    }
    documentoPcd.value = null
    editandoAtleta.value = false
  } catch (e) {
    erroAtleta.value = extrairErro(e)
  } finally {
    salvandoAtleta.value = false
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
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Meu perfil</h1>
    <p class="mt-1 text-sm text-slate-500">Seus dados de cadastro como atleta.</p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <p v-else-if="erro" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <template v-else>
      <!-- Card Quero ser Organizador -->
      <div class="mt-8 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="font-black text-base text-amber-950 flex items-center gap-2">
            <span>🏆</span> Quer organizar seus próprios eventos esportivos?
          </p>
          <p class="text-xs text-amber-800 mt-1">
            Crie corridas e campeonatos, gerencie inscrições e receba via PIX e Cartão com repasses automáticos Asaas.
          </p>
        </div>
        <a
          :href="organizerLink"
          target="_blank"
          class="rounded-xl bg-amber-500 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-amber-600 transition"
        >
          Quero ser Organizador 🚀
        </a>
      </div>

      <!-- Dados do atleta -->
      <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xl font-bold text-white"
              :disabled="enviandoFoto"
              @click="abrirSeletorFoto"
            >
              <img v-if="fotoUrl" :src="fotoUrl" alt="Foto de perfil" class="h-full w-full object-cover" />
              <span v-else>{{ (cliente?.pf?.nomeCompleto || user?.email || '?').slice(0, 1).toUpperCase() }}</span>

              <span
                class="absolute inset-0 flex items-center justify-center bg-black/50 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                :class="{ 'opacity-100': enviandoFoto }"
              >
                {{ enviandoFoto ? '...' : '📷' }}
              </span>
            </button>
            <input ref="fotoInputRef" type="file" accept="image/*" class="hidden" @change="onFotoSelecionada" />

            <div>
              <p class="text-lg font-bold text-slate-800">{{ cliente?.pf?.nomeCompleto || 'Sem nome cadastrado' }}</p>
              <p class="text-sm text-slate-500">{{ user?.email }}</p>
              <button type="button" class="mt-1 text-xs font-semibold text-secondary hover:underline" @click="abrirSeletorFoto">
                {{ fotoUrl ? 'Trocar foto' : 'Adicionar foto' }}
              </button>
            </div>
          </div>
          <button
            v-if="!editandoAtleta"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
            @click="abrirEdicaoAtleta"
          >
            Editar
          </button>
        </div>

        <p v-if="erroFoto" class="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ erroFoto }}
        </p>

        <dl v-if="!editandoAtleta && cliente?.pf" class="mt-6 grid gap-4 sm:grid-cols-2">
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
          <div v-if="cliente.pf.pcd">
            <dt class="text-xs font-bold uppercase tracking-wide text-slate-400">PCD</dt>
            <dd class="mt-1 text-sm text-slate-700">
              Sim
              <template v-if="cliente.pf.documentoPcdUrl"> · documento enviado</template>
              <span v-else class="text-warning"> · documento pendente</span>
            </dd>
          </div>
        </dl>

        <form v-else-if="editandoAtleta" class="mt-6 flex flex-col gap-4" @submit.prevent="salvarAtleta">
          <p v-if="erroAtleta" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {{ erroAtleta }}
          </p>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Nome completo</label>
            <input
              v-model="atletaForm.nomeCompleto"
              type="text"
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-semibold text-slate-700">CPF</label>
              <input
                :value="atletaForm.cpf"
                @input="formatarCpf"
                type="text"
                inputmode="numeric"
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
            <label class="mb-1 block text-sm font-semibold text-slate-700">
              {{ cliente?.pf?.documentoPcdUrl ? 'Trocar documento comprobatório (opcional)' : 'Documento que comprove a condição de PCD' }}
            </label>
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
          <div class="flex gap-3">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
              @click="editandoAtleta = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="salvandoAtleta"
              class="flex-1 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
            >
              {{ salvandoAtleta ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Endereço -->
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
              <input
                :value="enderecoForm.cep"
                @input="formatarCep"
                type="text"
                inputmode="numeric"
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
              required
              class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label class="mb-1 block text-sm font-semibold text-slate-700">Complemento (opcional)</label>
            <input
              v-model="enderecoForm.complemento"
              type="text"
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
          <div class="flex gap-3">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
              @click="editandoEndereco = false"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="salvandoEndereco"
              class="flex-1 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
            >
              {{ salvandoEndereco ? 'Salvando...' : 'Salvar' }}
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>
