<script setup lang="ts">
import type { AdminItem } from '../../composables/useAdminGerenciamento'

const { user } = useAuth()
const { admins, carregando, listarAdmins, criarAdmin } = useAdminGerenciamento()

const erro = ref('')
const sucessoMsg = ref('')

// Modal de Criação de Administrador
const modalCriarAberto = ref(false)
const salvando = ref(false)
const erroModal = ref('')
const mostrarSenha = ref(false)

const form = reactive({
  nome: '',
  email: '',
  password: '',
  confirmPassword: ''
})

onMounted(async () => {
  await carregar()
})

async function carregar() {
  erro.value = ''
  try {
    await listarAdmins()
  } catch (e: any) {
    erro.value = e?.data?.message || 'Erro ao carregar lista de administradores.'
  }
}

function abrirModalCriar() {
  form.nome = ''
  form.email = ''
  form.password = ''
  form.confirmPassword = ''
  erroModal.value = ''
  mostrarSenha.value = false
  modalCriarAberto.value = true
}

function fecharModalCriar() {
  modalCriarAberto.value = false
  erroModal.value = ''
}

async function onCriarAdmin() {
  erroModal.value = ''
  const nomeLimpo = form.nome.trim()
  const emailLimpo = form.email.trim().toLowerCase()
  const senha = form.password.trim()

  if (!nomeLimpo) {
    erroModal.value = 'Informe o nome do administrador.'
    return
  }

  if (!emailLimpo || !emailLimpo.includes('@')) {
    erroModal.value = 'Informe um e-mail válido.'
    return
  }

  if (senha.length < 6) {
    erroModal.value = 'A senha deve ter no mínimo 6 caracteres.'
    return
  }

  if (senha !== form.confirmPassword.trim()) {
    erroModal.value = 'As senhas não coincidem. Digite novamente.'
    return
  }

  salvando.value = true
  try {
    const novo = await criarAdmin({
      nome: nomeLimpo,
      email: emailLimpo,
      password: senha
    })
    sucessoMsg.value = `Administrador "${novo.nome}" (${novo.email}) adicionado com sucesso! Já pode realizar login na plataforma.`
    fecharModalCriar()
  } catch (e: any) {
    erroModal.value = e?.data?.message || 'Erro ao criar administrador. Verifique os dados.'
  } finally {
    salvando.value = false
  }
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

function extrairIniciais(nome?: string, email?: string) {
  if (nome && nome.trim()) {
    const partes = nome.trim().split(' ')
    if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase()
    return nome.slice(0, 2).toUpperCase()
  }
  return email ? email.slice(0, 2).toUpperCase() : 'AD'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Top Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Configurações & Administradores</h1>
          <span class="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            MASTER
          </span>
        </div>
        <p class="mt-1 text-sm text-slate-500">
          Gerencie os membros da equipe autorizados a administrar a plataforma SeuPercurso.
        </p>
      </div>

      <button
        type="button"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-md transition hover:brightness-110 shrink-0 cursor-pointer"
        @click="abrirModalCriar"
      >
        <AppIcon name="users" size="18" />
        + Adicionar Administrador
      </button>
    </div>

    <!-- Cards Informativos -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Total de Administradores</p>
        <p class="mt-2 text-2xl font-black text-slate-900">{{ admins.length }}</p>
        <p class="mt-1 text-xs text-slate-500">Membros com acesso ativo</p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Sua Sessão Atual</p>
        <p class="mt-2 text-base font-black text-slate-900 truncate">{{ user?.nome || 'Administrador' }}</p>
        <p class="mt-1 text-xs text-slate-500 truncate">{{ user?.email }}</p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-400">Nível de Segurança</p>
        <div class="mt-2 flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block"></span>
          <p class="text-base font-black text-emerald-700">Proteção Ativa</p>
        </div>
        <p class="mt-1 text-xs text-slate-500">Senhas criptografadas com bcrypt</p>
      </div>
    </div>

    <!-- Mensagens de Alerta / Sucesso -->
    <div
      v-if="sucessoMsg"
      class="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
    >
      <div class="flex items-center gap-2">
        <span class="text-emerald-600 font-black">✓</span>
        <span>{{ sucessoMsg }}</span>
      </div>
      <button type="button" class="text-emerald-700 hover:text-emerald-900 cursor-pointer" @click="sucessoMsg = ''">✕</button>
    </div>

    <div
      v-if="erro"
      class="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
    >
      <div class="flex items-center gap-2">
        <span class="text-red-600 font-bold">✕</span>
        <span>{{ erro }}</span>
      </div>
      <button type="button" class="text-red-700 hover:text-red-900 cursor-pointer" @click="erro = ''">✕</button>
    </div>

    <!-- Lista de Administradores -->
    <div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
        <div>
          <h2 class="text-sm font-extrabold text-slate-900 uppercase tracking-wide">Administradores Autorizados</h2>
          <p class="text-xs text-slate-500">Usuários que possuem credenciais para acessar este painel</p>
        </div>
        <button
          type="button"
          class="text-xs font-bold text-primary hover:underline cursor-pointer"
          :disabled="carregando"
          @click="carregar"
        >
          {{ carregando ? 'Atualizando...' : 'Recarregar Lista' }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="carregando" class="py-12 text-center text-sm font-semibold text-slate-500">
        Carregando lista de administradores...
      </div>

      <!-- Tabela / Lista -->
      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="admin in admins"
          :key="admin.id"
          class="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between transition hover:bg-slate-50/80"
        >
          <div class="flex items-center gap-3.5">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 font-black text-sm text-white shadow-xs">
              {{ extrairIniciais(admin.nome, admin.email) }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-extrabold text-slate-900 text-sm sm:text-base">{{ admin.nome }}</span>
                <span
                  v-if="admin.email.toLowerCase() === user?.email?.toLowerCase()"
                  class="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-800"
                >
                  Você (Sessão Atual)
                </span>
                <span class="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  Acesso Total
                </span>
              </div>
              <p class="text-xs font-mono text-slate-500 mt-0.5">{{ admin.email }}</p>
            </div>
          </div>

          <div class="flex items-center gap-4 text-xs text-slate-500 sm:text-right">
            <div>
              <p class="font-bold text-slate-700">Membro desde</p>
              <p class="text-[11px]">{{ formatarData(admin.createdAt) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Adicionar Administrador -->
    <div
      v-if="modalCriarAberto"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <AppIcon name="users" size="18" />
            </div>
            <div>
              <h3 class="font-extrabold text-slate-900 text-base">Adicionar Administrador</h3>
              <p class="text-xs text-slate-500">Conceder acesso ao painel master</p>
            </div>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-600 cursor-pointer" @click="fecharModalCriar">
            <AppIcon name="close" size="18" />
          </button>
        </div>

        <form class="mt-4 space-y-4" @submit.prevent="onCriarAdmin">
          <div>
            <label class="block text-xs font-bold uppercase text-slate-700">Nome Completo *</label>
            <input
              v-model="form.nome"
              type="text"
              required
              placeholder="Ex: João da Silva"
              class="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-700">E-mail de Login *</label>
            <input
              v-model="form.email"
              type="email"
              required
              placeholder="colega@email.com"
              class="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold uppercase text-slate-700">Senha de Acesso *</label>
              <button
                type="button"
                class="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                @click="mostrarSenha = !mostrarSenha"
              >
                {{ mostrarSenha ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>
            <input
              v-model="form.password"
              :type="mostrarSenha ? 'text' : 'password'"
              required
              minlength="6"
              placeholder="Mínimo 6 caracteres"
              class="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label class="block text-xs font-bold uppercase text-slate-700">Confirmar Senha *</label>
            <input
              v-model="form.confirmPassword"
              :type="mostrarSenha ? 'text' : 'password'"
              required
              minlength="6"
              placeholder="Digite a senha novamente"
              class="mt-1 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 leading-relaxed">
            <p class="font-bold">⚠️ Atenção:</p>
            <p class="mt-0.5">O novo administrador terá acesso completo às funções do painel administrativo. Não compartilhe senhas com pessoas não autorizadas.</p>
          </div>

          <p v-if="erroModal" class="rounded-lg bg-red-50 p-2.5 text-xs font-semibold text-red-600">
            {{ erroModal }}
          </p>

          <div class="mt-6 flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-50 cursor-pointer"
              @click="fecharModalCriar"
            >
              Cancelar
            </button>
            <button
              type="submit"
              :disabled="salvando"
              class="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase text-white hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {{ salvando ? 'Cadastrando...' : 'Cadastrar Administrador' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
