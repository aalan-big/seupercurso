<script setup lang="ts">
import { Check, X, AlertTriangle } from 'lucide-vue-next'
import type { UsuarioAdmin } from '../../composables/useAdminUsuarios'

const { usuarios, buscarUsuarios, verificarEmail, alterarEmail, criarUsuario } = useAdminUsuarios()

const termoBusca = ref('')
const carregando = ref(false)
const buscando = ref(false)
const erro = ref('')
const sucessoMsg = ref('')

// Controle de ativação individual
const ativandoId = ref<string | null>(null)

// Controle do modal de correção de e-mail
const modalAberto = ref(false)
const usuarioSelecionado = ref<UsuarioAdmin | null>(null)
const novoEmailInput = ref('')
const salvandoEmail = ref(false)
const erroModal = ref('')

// Controle do modal de criação manual de usuário
const modalCriarAberto = ref(false)
const criandoUsuario = ref(false)
const erroCriarModal = ref('')
const formCriar = reactive({
  nomeCompleto: '',
  email: '',
  cpf: '',
  celular: '',
  dataNascimento: '',
  genero: 'MASCULINO' as 'MASCULINO' | 'FEMININO' | 'OUTRO',
  password: ''
})

async function carregar(busca?: string) {
  erro.value = ''
  carregando.value = true
  try {
    await buscarUsuarios(busca)
  } catch (e: any) {
    erro.value = e?.data?.message || 'Erro ao buscar usuários.'
  } finally {
    carregando.value = false
  }
}

async function onBuscar() {
  erro.value = ''
  sucessoMsg.value = ''
  buscando.value = true
  try {
    await buscarUsuarios(termoBusca.value.trim() || undefined)
  } catch (e: any) {
    erro.value = e?.data?.message || 'Erro ao pesquisar usuários.'
  } finally {
    buscando.value = false
  }
}

function onLimpar() {
  termoBusca.value = ''
  carregar()
}

async function onAprovarEmail(usuario: UsuarioAdmin) {
  if (ativandoId.value) return
  ativandoId.value = usuario.id
  erro.value = ''
  sucessoMsg.value = ''
  try {
    await verificarEmail(usuario.id)
    sucessoMsg.value = `Conta de ${nomeExibicao(usuario)} (${usuario.email}) aprovada com sucesso!`
  } catch (e: any) {
    erro.value = e?.data?.message || 'Erro ao aprovar e-mail.'
  } finally {
    ativandoId.value = null
  }
}

function abrirModalCorrigir(usuario: UsuarioAdmin) {
  usuarioSelecionado.value = usuario
  novoEmailInput.value = usuario.email
  erroModal.value = ''
  modalAberto.value = true
}

function fecharModal() {
  modalAberto.value = false
  usuarioSelecionado.value = null
  novoEmailInput.value = ''
  erroModal.value = ''
}

async function onSalvarNovoEmail() {
  if (!usuarioSelecionado.value) return
  const emailLimpo = novoEmailInput.value.trim().toLowerCase()
  if (!emailLimpo || !emailLimpo.includes('@')) {
    erroModal.value = 'Por favor, informe um endereço de e-mail válido.'
    return
  }

  salvandoEmail.value = true
  erroModal.value = ''
  try {
    await alterarEmail(usuarioSelecionado.value.id, emailLimpo)
    sucessoMsg.value = `E-mail alterado para ${emailLimpo} e conta liberada com sucesso!`
    fecharModal()
  } catch (e: any) {
    erroModal.value = e?.data?.message || 'Erro ao alterar e-mail.'
  } finally {
    salvandoEmail.value = false
  }
}

function abrirModalCriar() {
  formCriar.nomeCompleto = ''
  formCriar.email = ''
  formCriar.cpf = ''
  formCriar.celular = ''
  formCriar.dataNascimento = ''
  formCriar.genero = 'MASCULINO'
  formCriar.password = ''
  erroCriarModal.value = ''
  modalCriarAberto.value = true
}

function fecharModalCriar() {
  modalCriarAberto.value = false
  erroCriarModal.value = ''
}

async function onSalvarNovoUsuario() {
  if (!formCriar.nomeCompleto.trim()) {
    erroCriarModal.value = 'Informe o nome completo do atleta.'
    return
  }
  if (!formCriar.email.trim() || !formCriar.email.includes('@')) {
    erroCriarModal.value = 'Informe um e-mail válido.'
    return
  }
  const cpfLimpo = formCriar.cpf.replace(/\D/g, '')
  if (cpfLimpo.length !== 11) {
    erroCriarModal.value = 'O CPF deve ter exatamente 11 dígitos numéricos.'
    return
  }

  criandoUsuario.value = true
  erroCriarModal.value = ''
  try {
    const res = await criarUsuario({
      nomeCompleto: formCriar.nomeCompleto.trim(),
      email: formCriar.email.trim().toLowerCase(),
      cpf: cpfLimpo,
      celular: formCriar.celular.trim() || undefined,
      dataNascimento: formCriar.dataNascimento || undefined,
      genero: formCriar.genero,
      password: formCriar.password.trim() || undefined
    })
    sucessoMsg.value = `Atleta "${formCriar.nomeCompleto}" cadastrado com sucesso! Senha de acesso definida: ${res.senhaDefinida}`
    fecharModalCriar()
  } catch (e: any) {
    erroCriarModal.value = e?.data?.message || 'Erro ao cadastrar usuário.'
  } finally {
    criandoUsuario.value = false
  }
}

function nomeExibicao(u: UsuarioAdmin) {
  return u.cliente?.pf?.nomeCompleto || u.cliente?.pj?.razaoSocial || 'Atleta sem nome cadastrado'
}

function formatarCpf(cpf?: string | null) {
  if (!cpf) return null
  const limpo = cpf.replace(/\D/g, '')
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return cpf
}

function formatarData(dataIso: string) {
  try {
    return new Date(dataIso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dataIso
  }
}

onMounted(() => {
  carregar()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Usuários & Atletas</h1>
        <p class="mt-1 text-sm text-slate-500">
          Localize contas por e-mail, nome ou CPF, ative contas pendentes com 1 clique e cadastre ou corrija atletas.
        </p>
      </div>
      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-md transition hover:brightness-110 shrink-0"
        @click="abrirModalCriar"
      >
        <AppIcon name="users" size="18" />
        + Novo Usuário
      </button>
    </div>

    <!-- Barra de Busca -->
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="onBuscar">
        <div class="relative flex-1">
          <input
            v-model="termoBusca"
            type="text"
            placeholder="Buscar por e-mail (ex: noeme, ruthinha), nome ou CPF..."
            class="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div class="flex gap-2">
          <button
            type="submit"
            :disabled="buscando"
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            <span v-if="buscando">Buscando...</span>
            <span v-else>Buscar</span>
          </button>
          <button
            v-if="termoBusca"
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            @click="onLimpar"
          >
            Limpar
          </button>
        </div>
      </form>
    </div>

    <!-- Mensagens de Alerta / Sucesso -->
    <div
      v-if="sucessoMsg"
      class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
    >
      <span class="flex items-center gap-2"><Check :size="16" class="shrink-0" /> {{ sucessoMsg }}</span>
      <button type="button" class="text-emerald-700 hover:text-emerald-900" aria-label="Fechar" @click="sucessoMsg = ''"><X :size="16" /></button>
    </div>

    <div
      v-if="erro"
      class="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
    >
      <span class="flex items-center gap-2"><AlertTriangle :size="16" class="shrink-0" /> {{ erro }}</span>
      <button type="button" class="text-red-700 hover:text-red-900" aria-label="Fechar" @click="erro = ''"><X :size="16" /></button>
    </div>

    <!-- Loading -->
    <div v-if="carregando" class="py-12 text-center text-sm font-semibold text-slate-500">
      Carregando lista de usuários...
    </div>

    <!-- Vazio -->
    <div
      v-else-if="usuarios.length === 0"
      class="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"
    >
      <p class="font-bold text-slate-700">Nenhum usuário encontrado</p>
      <p class="mt-1 text-xs text-slate-400">
        Tente pesquisar com outro termo ou limpe o campo para ver os cadastros mais recentes.
      </p>
    </div>

    <!-- Lista de Usuários -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
        <span>Exibindo {{ usuarios.length }} usuário(s)</span>
      </div>

      <div
        v-for="u in usuarios"
        :key="u.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
      >
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <!-- Coluna 1: Dados do Atleta -->
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-base font-extrabold text-slate-900">
                {{ nomeExibicao(u) }}
              </h3>

              <!-- Badge de E-mail Verificado -->
              <span
                v-if="u.emailVerificado"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800"
              >
                <AppIcon name="check" size="13" />
                E-mail Verificado
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800"
              >
                <AlertTriangle :size="12" /> E-mail Pendente (Travado)
              </span>
            </div>

            <!-- Dados Secundários -->
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span v-if="u.cliente?.pf?.cpf">
                <strong>CPF:</strong> {{ formatarCpf(u.cliente.pf.cpf) }}
              </span>
              <span v-else-if="u.cliente?.pj?.cnpj">
                <strong>CNPJ:</strong> {{ u.cliente.pj.cnpj }}
              </span>
              <span v-if="u.cliente?.pf?.celular || u.cliente?.pj?.celularComercial">
                <strong>Celular:</strong> {{ u.cliente?.pf?.celular || u.cliente?.pj?.celularComercial }}
              </span>
              <span>
                <strong>Cadastrado em:</strong> {{ formatarData(u.createdAt) }}
              </span>
              <span>
                <strong>Inscrições:</strong> {{ u.cliente?._count?.inscricoes || 0 }}
              </span>
            </div>
          </div>

          <!-- Coluna 2: E-mail e Botões de Ação -->
          <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center md:justify-end">
            <!-- Box do E-mail -->
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-bold text-slate-700">
              {{ u.email }}
            </div>

            <!-- Botão Corrigir E-mail -->
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
              title="Corrigir e-mail digitado errado"
              @click="abrirModalCorrigir(u)"
            >
              <AppIcon name="pencil" size="14" class="text-slate-500" />
              Corrigir E-mail
            </button>

            <!-- Botão Aprovar E-mail (Se não verificado) -->
            <button
              v-if="!u.emailVerificado"
              type="button"
              :disabled="ativandoId === u.id"
              class="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
              @click="onAprovarEmail(u)"
            >
              <AppIcon name="check" size="14" />
              {{ ativandoId === u.id ? 'Liberando...' : 'Liberar Conta Agora' }}
            </button>
          </div>
        </div>

        <!-- Inscrições Recentes (Se houver) -->
        <div
          v-if="u.cliente?.inscricoes && u.cliente.inscricoes.length > 0"
          class="mt-3 border-t border-slate-100 pt-3"
        >
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Inscrições recentes:</p>
          <div class="mt-1 flex flex-wrap gap-2">
            <span
              v-for="insc in u.cliente.inscricoes"
              :key="insc.id"
              class="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
            >
              <strong class="mr-1 text-slate-900">{{ insc.categoria.modalidade.evento.nome }}</strong>
              ({{ insc.categoria.nome }}) —
              <span
                class="ml-1 font-bold"
                :class="insc.status === 'CONFIRMADA' ? 'text-emerald-600' : 'text-amber-600'"
              >
                {{ insc.status }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal para Corrigir E-mail -->
    <div
      v-if="modalAberto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="fecharModal"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 class="text-base font-extrabold uppercase tracking-tight text-primary">
            Corrigir E-mail do Usuário
          </h2>
          <button type="button" class="text-slate-400 hover:text-slate-600" @click="fecharModal">
            <AppIcon name="close" size="18" />
          </button>
        </div>

        <div class="mt-4 space-y-3">
          <p class="text-xs text-slate-600">
            <strong>Atleta:</strong> {{ usuarioSelecionado ? nomeExibicao(usuarioSelecionado) : '' }}
          </p>
          <p class="text-xs text-slate-500">
            Digite o e-mail correto abaixo. Ao salvar, o e-mail será atualizado e a conta será <strong>aprovada automaticamente</strong> para compra.
          </p>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-700">Novo Endereço de E-mail</label>
            <input
              v-model="novoEmailInput"
              type="email"
              placeholder="ex: atleta@gmail.com"
              class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @keydown.enter.prevent="onSalvarNovoEmail"
            />
          </div>

          <p v-if="erroModal" class="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-600">
            {{ erroModal }}
          </p>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50"
            @click="fecharModal"
          >
            Cancelar
          </button>
          <button
            type="button"
            :disabled="salvandoEmail"
            class="rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase text-white hover:bg-primary/90 disabled:opacity-50"
            @click="onSalvarNovoEmail"
          >
            {{ salvandoEmail ? 'Salvando...' : 'Salvar e Liberar Conta' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal para Cadastrar Novo Usuário / Atleta -->
    <div
      v-if="modalCriarAberto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="fecharModalCriar"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 class="text-base font-extrabold uppercase tracking-tight text-primary">
            Cadastrar Novo Atleta / Usuário
          </h2>
          <button type="button" class="text-slate-400 hover:text-slate-600" @click="fecharModalCriar">
            <AppIcon name="close" size="18" />
          </button>
        </div>

        <form class="mt-4 space-y-3.5" @submit.prevent="onSalvarNovoUsuario">
          <div>
            <label class="block text-xs font-bold uppercase text-slate-700">Nome Completo *</label>
            <input
              v-model="formCriar.nomeCompleto"
              type="text"
              required
              placeholder="Ex: Carlos Eduardo da Silva"
              class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="block text-xs font-bold uppercase text-slate-700">E-mail *</label>
              <input
                v-model="formCriar.email"
                type="email"
                required
                placeholder="atleta@gmail.com"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-700">CPF *</label>
              <input
                v-model="formCriar.cpf"
                type="text"
                required
                maxlength="14"
                placeholder="000.000.000-00"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label class="block text-xs font-bold uppercase text-slate-700">Celular / WhatsApp</label>
              <input
                v-model="formCriar.celular"
                type="tel"
                placeholder="(88) 99999-9999"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-700">Nascimento</label>
              <input
                v-model="formCriar.dataNascimento"
                type="date"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label class="block text-xs font-bold uppercase text-slate-700">Gênero</label>
              <select
                v-model="formCriar.genero"
                class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-700">Senha de Acesso</label>
            <input
              v-model="formCriar.password"
              type="text"
              placeholder="Opcional (se vazio, o sistema gera uma senha aleatória)"
              class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p class="mt-1 text-[11px] text-slate-400">
              O usuário já nasce com a <strong>conta ativada e liberada</strong> para comprar ingressos.
            </p>
          </div>

          <p v-if="erroCriarModal" class="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600">
            {{ erroCriarModal }}
          </p>

          <div class="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50"
              @click="fecharModalCriar"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="criandoUsuario"
              class="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {{ criandoUsuario ? 'Cadastrando...' : 'Cadastrar e Liberar Conta' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
