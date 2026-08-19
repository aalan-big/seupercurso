<script setup lang="ts">
const { user, logout } = useAuth()

const notificacoesAbertas = ref(false)
const configuracoesAbertas = ref(false)
const perfilAberto = ref(false)

const notificacoes = ref([
  { id: '1', tipo: 'kyc', titulo: 'Novo Cadastro de Organizador', descricao: 'Selfie e RG enviados para análise KYC', hora: 'Há 5 min', lida: false },
  { id: '2', tipo: 'saque', titulo: 'Solicitação de Saque PIX', descricao: 'Organizador solicitou R$ 54,00 com trava de titularidade', hora: 'Há 18 min', lida: false },
  { id: '3', tipo: 'venda', titulo: 'Nova Inscrição Confirmada', descricao: 'Inscrição #105 paga via PIX Asaas D+0', hora: 'Há 40 min', lida: true }
])

const naoLidas = computed(() => notificacoes.value.filter(n => !n.lida).length)

const iniciais = computed(() => {
  if (!user.value?.nome && !user.value?.email) return 'AA'
  if (user.value?.nome) {
    const partes = user.value.nome.trim().split(' ')
    if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase()
    return user.value.nome.slice(0, 2).toUpperCase()
  }
  return user.value?.email.slice(0, 2).toUpperCase() || 'AA'
})

function marcarTodasLidas() {
  notificacoes.value.forEach(n => n.lida = true)
}

async function onSair() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <header class="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-6 shadow-2xs backdrop-blur-md">
    <!-- Esquerda: Título da Plataforma & Indicador Master -->
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <span class="text-xl">🏃</span>
        <span class="text-base font-black tracking-tight text-slate-900">
          Seu<span class="text-amber-500">Percurso</span>
        </span>
        <span class="rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs">
          👑 MASTER ADMIN
        </span>
      </div>
    </div>

    <!-- Direita: Sininho, Engrenagem e Avatar -->
    <div class="flex items-center gap-3">
      <!-- 🔔 1. Sininho de Notificações -->
      <div class="relative">
        <button
          type="button"
          class="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          title="Notificações"
          @click="notificacoesAbertas = !notificacoesAbertas; configuracoesAbertas = false; perfilAberto = false"
        >
          <span class="text-lg">🔔</span>
          <span v-if="naoLidas > 0" class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-xs">
            {{ naoLidas }}
          </span>
        </button>

        <!-- Dropdown de Notificações -->
        <div v-if="notificacoesAbertas" class="absolute right-0 mt-3 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl z-50">
          <div class="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
            <div class="flex items-center gap-2">
              <span class="font-black text-xs text-slate-900">🔔 Notificações Master</span>
              <span v-if="naoLidas > 0" class="rounded-full bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5">
                {{ naoLidas }} novas
              </span>
            </div>
            <button
              type="button"
              class="text-[11px] font-bold text-blue-600 hover:underline"
              @click="marcarTodasLidas"
            >
              Marcar como lidas
            </button>
          </div>

          <div class="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            <div
              v-for="n in notificacoes"
              :key="n.id"
              class="p-4 transition hover:bg-slate-50"
              :class="!n.lida ? 'bg-blue-50/40' : ''"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="text-xs font-black text-slate-900">{{ n.titulo }}</p>
                <span class="text-[10px] font-semibold text-slate-400 whitespace-nowrap">{{ n.hora }}</span>
              </div>
              <p class="mt-1 text-[11px] text-slate-600 leading-relaxed">{{ n.descricao }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ⚙️ 2. Engrenagem de Configurações Master -->
      <div class="relative">
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          title="Configurações Master"
          @click="configuracoesAbertas = !configuracoesAbertas; notificacoesAbertas = false; perfilAberto = false"
        >
          <span class="text-lg">⚙️</span>
        </button>

        <!-- Dropdown de Configurações Master -->
        <div v-if="configuracoesAbertas" class="absolute right-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl z-50 space-y-4">
          <div class="border-b border-slate-100 pb-3">
            <h4 class="font-black text-xs text-slate-900">⚙️ Configurações Master</h4>
            <p class="text-[11px] text-slate-500">Parâmetros globais do sistema</p>
          </div>

          <div class="space-y-3 text-xs">
            <NuxtLink to="/financeiro" class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition text-slate-800 font-bold" @click="configuracoesAbertas = false">
              <span>💳</span> Taxa de Comissão Asaas (10%)
            </NuxtLink>
            <NuxtLink to="/organizadores" class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition text-slate-800 font-bold" @click="configuracoesAbertas = false">
              <span>🛡️</span> Regras de Verificação KYC
            </NuxtLink>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
              <span class="font-bold block text-slate-800">API Asaas Status:</span>
              <span class="text-emerald-700 font-bold">🟢 Subconta Master Operacional</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 👤 3. Badge do Perfil do Usuário com Avatar (AA aalanallvesgt@gmail.com) -->
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 pr-3 hover:bg-slate-100 transition"
          @click="perfilAberto = !perfilAberto; notificacoesAbertas = false; configuracoesAbertas = false"
        >
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-black text-xs text-white shadow-xs">
            {{ iniciais }}
          </div>
          <span class="text-xs font-bold text-slate-800 line-clamp-1">
            {{ user?.email || 'aalanallvesgt@gmail.com' }}
          </span>
        </button>

        <!-- Dropdown de Ações do Perfil -->
        <div v-if="perfilAberto" class="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
          <div class="p-3 border-b border-slate-100 text-xs">
            <p class="font-black text-slate-900">{{ user?.nome || 'Administrador Master' }}</p>
            <p class="text-[11px] text-slate-500 font-mono">{{ user?.email || 'aalanallvesgt@gmail.com' }}</p>
          </div>
          <button
            type="button"
            class="w-full mt-1 text-left px-3 py-2 text-xs font-bold text-red-600 rounded-xl hover:bg-red-50 transition flex items-center gap-2"
            @click="onSair"
          >
            <span>🚪</span> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
