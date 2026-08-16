<script setup lang="ts">
definePageMeta({ layout: false })

const { token, user, register, login, fetchMe, logout } = useAuth()
const { cliente, createPessoaFisica, createPessoaJuridica, fetchMe: fetchClienteMe } = useCliente()
const { eventos, eventoSelecionado, fetchEventos, fetchEvento } = useEvento()
const { minhasInscricoes, criar: criarInscricao, fetchMinhas: fetchMinhasInscricoes } = useInscricao()
const { criar: criarPagamento, simularAprovacao, simularRecusa } = usePagamento()

const erro = ref('')
const carregando = ref(false)

// --- Auth ---
const registerForm = reactive({ email: '', password: '' })
const loginForm = reactive({ email: '', password: '' })

async function onRegister() {
  await executar(() => register(registerForm.email, registerForm.password))
}
async function onLogin() {
  await executar(() => login(loginForm.email, loginForm.password))
}
async function onFetchMe() {
  await executar(() => fetchMe())
}
function onLogout() {
  logout()
  erro.value = ''
}

// --- Perfil (cliente PF/PJ) ---
const tipoPerfil = ref<'PF' | 'PJ'>('PF')
const pfForm = reactive({
  nomeCompleto: '',
  cpf: '',
  dataNascimento: '',
  genero: 'MASCULINO' as 'MASCULINO' | 'FEMININO' | 'OUTRO',
  celular: ''
})
const pjForm = reactive({
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  nomeResponsavel: '',
  documentoResponsavel: '',
  celularComercial: ''
})

async function onCreatePerfil() {
  await executar(() => (tipoPerfil.value === 'PF' ? createPessoaFisica(pfForm) : createPessoaJuridica(pjForm)))
}
async function onFetchClienteMe() {
  await executar(() => fetchClienteMe())
}

// --- Eventos ---
async function carregarEventos() {
  await executar(() => fetchEventos())
}
async function verDetalheEvento(id: string) {
  await executar(() => fetchEvento(id))
}

// --- Inscrição ---
const tamanhoCamisa = ref('M')
const categoriaEscolhida = reactive<Record<string, string>>({})

function chaveSelecao(loteId: string, modalidadeId: string) {
  return `${loteId}:${modalidadeId}`
}

function precoFormatado(valor: string) {
  return `R$ ${Number(valor).toFixed(2)}`
}

async function onInscrever(loteId: string, modalidadeId: string) {
  const categoriaId = categoriaEscolhida[chaveSelecao(loteId, modalidadeId)]
  if (!categoriaId) {
    erro.value = 'Escolha uma categoria antes de se inscrever.'
    return
  }
  await executar(() => criarInscricao({ categoriaId, loteId, tamanhoCamisa: tamanhoCamisa.value }))
}

async function onFetchMinhasInscricoes() {
  await executar(() => fetchMinhasInscricoes())
}

// --- Pagamento ---
const metodoEscolhido = reactive<Record<string, string>>({})

async function onPagar(inscricaoId: string) {
  const metodo = metodoEscolhido[inscricaoId] || 'PIX'
  await executar(async () => {
    await criarPagamento(inscricaoId, metodo)
    await fetchMinhasInscricoes()
  })
}

async function onSimularAprovacao(pagamentoId: string) {
  await executar(async () => {
    await simularAprovacao(pagamentoId)
    await fetchMinhasInscricoes()
  })
}

async function onSimularRecusa(pagamentoId: string) {
  await executar(async () => {
    await simularRecusa(pagamentoId)
    await fetchMinhasInscricoes()
  })
}

// --- Util ---
async function executar(acao: () => Promise<unknown>) {
  erro.value = ''
  carregando.value = true
  try {
    await acao()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

onMounted(carregarEventos)
</script>

<template>
  <div class="min-h-screen bg-slate-50 py-10">
    <div class="mx-auto max-w-3xl px-4">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900">🧪 Página de teste — SeuPercurso</h1>
        <p class="mt-1 text-sm text-slate-500">
          Página de desenvolvimento — não é a tela inicial do app. Fluxo completo: cadastro → login → perfil →
          eventos → inscrição.
        </p>
      </div>

      <p v-if="erro" class="sticky top-2 z-10 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
        {{ erro }}
      </p>

      <!-- SESSÃO -->
      <section class="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-lg font-semibold text-slate-800">1. Sessão</h2>

        <div class="grid gap-4 sm:grid-cols-2">
          <form class="flex flex-col gap-2" @submit.prevent="onRegister">
            <p class="text-xs font-medium uppercase text-slate-400">Cadastro</p>
            <input v-model="registerForm.email" type="email" placeholder="email" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="registerForm.password" type="password" placeholder="senha (min. 8)" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" :disabled="carregando" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              Registrar
            </button>
          </form>

          <form class="flex flex-col gap-2" @submit.prevent="onLogin">
            <p class="text-xs font-medium uppercase text-slate-400">Login</p>
            <input v-model="loginForm.email" type="email" placeholder="email" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="loginForm.password" type="password" placeholder="senha" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button type="submit" :disabled="carregando" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              Entrar
            </button>
          </form>
        </div>

        <div class="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <p><strong class="text-slate-800">Token:</strong> {{ token ? token.slice(0, 24) + '…' : '(nenhum)' }}</p>
          <div class="mt-2 flex gap-2">
            <button :disabled="!token" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40" @click="onFetchMe">
              Buscar /auth/me
            </button>
            <button :disabled="!token" class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40" @click="onLogout">
              Logout
            </button>
          </div>
          <pre v-if="user" class="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{{ JSON.stringify(user, null, 2) }}</pre>
        </div>
      </section>

      <!-- PERFIL -->
      <section class="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="mb-3 text-lg font-semibold text-slate-800">2. Perfil do cliente</h2>
        <p class="mb-3 text-xs text-slate-500">Precisa estar logado (passo 1) pra criar o perfil.</p>

        <div class="mb-3 flex gap-4 text-sm">
          <label class="flex items-center gap-1.5"><input v-model="tipoPerfil" type="radio" value="PF" /> Pessoa física</label>
          <label class="flex items-center gap-1.5"><input v-model="tipoPerfil" type="radio" value="PJ" /> Pessoa jurídica</label>
        </div>

        <form class="flex flex-col gap-2" @submit.prevent="onCreatePerfil">
          <template v-if="tipoPerfil === 'PF'">
            <input v-model="pfForm.nomeCompleto" placeholder="Nome completo" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="pfForm.cpf" placeholder="CPF" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="pfForm.dataNascimento" type="date" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select v-model="pfForm.genero" class="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="MASCULINO">Masculino</option>
              <option value="FEMININO">Feminino</option>
              <option value="OUTRO">Outro</option>
            </select>
            <input v-model="pfForm.celular" placeholder="Celular" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </template>
          <template v-else>
            <input v-model="pjForm.razaoSocial" placeholder="Razão social" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="pjForm.nomeFantasia" placeholder="Nome fantasia (opcional)" class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="pjForm.cnpj" placeholder="CNPJ" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="pjForm.nomeResponsavel" placeholder="Nome do responsável" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="pjForm.documentoResponsavel" placeholder="Documento do responsável" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input v-model="pjForm.celularComercial" placeholder="Celular comercial" required class="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </template>
          <button type="submit" :disabled="carregando || !token" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            Criar perfil
          </button>
        </form>

        <div class="mt-4 border-t border-slate-100 pt-4">
          <button :disabled="!token" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40" @click="onFetchClienteMe">
            Buscar /clientes/me
          </button>
          <pre v-if="cliente" class="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{{ JSON.stringify(cliente, null, 2) }}</pre>
        </div>
      </section>

      <!-- EVENTOS + INSCRIÇÃO -->
      <section class="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-800">3. Eventos e inscrição</h2>
          <button :disabled="carregando" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50" @click="carregarEventos">
            Atualizar lista
          </button>
        </div>

        <div class="mb-3 flex items-center gap-2 text-sm">
          <label class="text-slate-600">Tamanho da camisa pra inscrição:</label>
          <select v-model="tamanhoCamisa" class="rounded-lg border border-slate-300 px-2 py-1">
            <option>P</option>
            <option>M</option>
            <option>G</option>
            <option>GG</option>
          </select>
        </div>

        <p v-if="eventos.length === 0" class="text-sm text-slate-500">
          Nenhum evento publicado. Rode <code class="rounded bg-slate-200 px-1">npm run db:seed -w server</code>.
        </p>

        <div v-for="evento in eventos" :key="evento.id" class="mb-3 rounded-lg border border-slate-200 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold text-slate-800">{{ evento.nome }}</h3>
              <p class="text-xs text-slate-500">{{ evento.local }} · {{ evento.cidade }}/{{ evento.estado }} · {{ formatarData(evento.dataInicio) }}</p>
            </div>
            <button class="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700" @click="verDetalheEvento(evento.id)">
              Ver detalhes
            </button>
          </div>

          <div v-if="eventoSelecionado?.id === evento.id" class="mt-3 border-t border-slate-100 pt-3">
            <div v-for="lote in eventoSelecionado.lotes" :key="lote.id" class="mb-2 rounded-lg border border-slate-200 p-3 text-xs">
              <p class="mb-2 font-medium text-slate-800">
                {{ lote.nome }}
                <span class="font-normal text-slate-400">({{ formatarData(lote.inicioVenda) }} – {{ formatarData(lote.fimVenda) }})</span>
              </p>

              <div v-for="preco in lote.precos" :key="preco.id" class="mb-2 flex flex-wrap items-center gap-2">
                <span class="font-medium text-slate-700">
                  {{ eventoSelecionado.modalidades.find((m) => m.id === preco.modalidadeId)?.nome }} —
                  {{ precoFormatado(preco.valor) }}
                </span>
                <select
                  v-model="categoriaEscolhida[chaveSelecao(lote.id, preco.modalidadeId)]"
                  class="rounded border border-slate-300 px-2 py-1"
                >
                  <option value="" disabled>categoria...</option>
                  <option
                    v-for="cat in eventoSelecionado.modalidades.find((m) => m.id === preco.modalidadeId)?.categorias"
                    :key="cat.id"
                    :value="cat.id"
                  >
                    {{ cat.nome }}
                  </option>
                </select>
                <button
                  :disabled="carregando || !token"
                  class="rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700 disabled:opacity-40"
                  @click="onInscrever(lote.id, preco.modalidadeId)"
                >
                  Inscrever
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 border-t border-slate-100 pt-4">
          <button :disabled="!token" class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-40" @click="onFetchMinhasInscricoes">
            Buscar /inscricoes/me
          </button>
          <div v-if="minhasInscricoes.length" class="mt-3 flex flex-col gap-2">
            <div v-for="ins in minhasInscricoes" :key="ins.id" class="rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              <p>
                {{ ins.categoria.modalidade.evento.nome }} — {{ ins.categoria.modalidade.nome }} / {{ ins.categoria.nome }} —
                lote {{ ins.lote.nome }} — status: <strong>{{ ins.status }}</strong> — camisa: {{ ins.tamanhoCamisa }}
              </p>

              <div v-if="ins.status === 'PENDENTE_PAGAMENTO'" class="mt-2 flex items-center gap-2">
                <select v-model="metodoEscolhido[ins.id]" class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100">
                  <option value="PIX">PIX</option>
                  <option value="CARTAO_CREDITO">Cartão de crédito</option>
                  <option value="CARTAO_DEBITO">Cartão de débito</option>
                  <option value="BOLETO">Boleto</option>
                </select>
                <button
                  :disabled="carregando"
                  class="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                  @click="onPagar(ins.id)"
                >
                  Pagar
                </button>
              </div>

              <ul v-if="ins.pagamentos.length" class="mt-2 flex flex-col gap-1 border-t border-slate-700 pt-2">
                <li v-for="pag in ins.pagamentos" :key="pag.id" class="flex flex-wrap items-center gap-2">
                  <span>{{ pag.metodo }} — {{ precoFormatado(pag.valor) }} — status: <strong>{{ pag.status }}</strong></span>
                  <template v-if="pag.status === 'PENDENTE'">
                    <button class="rounded bg-emerald-600 px-2 py-0.5 text-white hover:bg-emerald-700" @click="onSimularAprovacao(pag.id)">
                      Simular aprovação
                    </button>
                    <button class="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-700" @click="onSimularRecusa(pag.id)">
                      Simular recusa
                    </button>
                  </template>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
