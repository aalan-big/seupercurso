<script setup lang="ts">
const emit = defineEmits<{ 'abrir-menu': [] }>()

const { user, logout } = useAuth()

const notificacoesAbertas = ref(false)
const configuracoesAbertas = ref(false)
const perfilAberto = ref(false)

// Comissoes recebidas, as mesmas que disparam o alerta sonoro e o push.
// Antes a lista era fixa no codigo ("Novo Cadastro de Organizador - Ha 5 min",
// "Saque PIX R$ 54,00") e aparecia sempre, para todo admin.
interface NotificacaoComissao {
  id: string
  valorTaxa: number
  valorTotal: number
  criadoEm: string
}

const api = useApi()
const notificacoes = ref<NotificacaoComissao[]>([])
// "Lida" e por aparelho: guarda ate quando a pessoa ja viu.
const CHAVE_VISTAS = 'admin_notificacoes_vistas_ate'
const vistasAte = ref(0)

const naoLidas = computed(
  () => notificacoes.value.filter((n) => new Date(n.criadoEm).getTime() > vistasAte.value).length
)

async function carregarNotificacoes() {
  try {
    notificacoes.value = await api<NotificacaoComissao[]>('/admin/notificacoes-historico')
  } catch {
    // Sem rede ou sessao expirada: o sininho so fica como estava.
  }
}

function formatarMoeda(v: number) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function tempoRelativo(iso: string) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  return new Date(iso).toLocaleDateString('pt-BR')
}

const iniciais = computed(() => {
  if (!user.value?.nome && !user.value?.email) return 'AD'
  if (user.value?.nome) {
    const partes = user.value.nome.trim().split(' ')
    if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase()
    return user.value.nome.slice(0, 2).toUpperCase()
  }
  return user.value?.email.slice(0, 2).toUpperCase() || 'AD'
})

function marcarTodasLidas() {
  vistasAte.value = Date.now()
  try {
    localStorage.setItem(CHAVE_VISTAS, String(vistasAte.value))
  } catch {}
}

function alternarNotificacoes() {
  notificacoesAbertas.value = !notificacoesAbertas.value
  configuracoesAbertas.value = false
  perfilAberto.value = false
  if (notificacoesAbertas.value) carregarNotificacoes()
}

function fecharTodos() {
  notificacoesAbertas.value = false
  configuracoesAbertas.value = false
  perfilAberto.value = false
}

function escHandler(e: KeyboardEvent) {
  if (e.key === 'Escape') fecharTodos()
}

let temporizadorNotificacoes: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  window.addEventListener('keydown', escHandler)
  try {
    vistasAte.value = Number(localStorage.getItem(CHAVE_VISTAS)) || 0
  } catch {}
  carregarNotificacoes()
  // O alerta em tempo real vem do plugin; aqui so mantem o numero do sininho.
  temporizadorNotificacoes = setInterval(carregarNotificacoes, 30_000)
  const { $notificacoes } = useNuxtApp() as any
  if ($notificacoes) {
    $notificacoes.solicitarPermissao()
    $notificacoes.conectarStream()
  }
})

// So neste aparelho: toca o som e mostra o alerta, sem avisar os outros admins.
function dispararTesteNotificacao() {
  const { $notificacoes } = useNuxtApp() as any
  if ($notificacoes) {
    $notificacoes.dispararNotificacaoPush(15.00)
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', escHandler)
  if (temporizadorNotificacoes) clearInterval(temporizadorNotificacoes)
})

async function onSair() {
  await logout()
  await navigateTo('/login')
}
</script>

<template>
  <!-- Overlay invisível para fechar qualquer dropdown ao clicar em qualquer lugar fora -->
  <div
    v-if="notificacoesAbertas || configuracoesAbertas || perfilAberto"
    class="fixed inset-0 z-30 bg-transparent"
    @click="fecharTodos"
  ></div>

  <header class="sticky top-0 z-40 flex h-auto min-h-16 w-full items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-2xs backdrop-blur-md sm:px-6">
    <!-- Esquerda: Menu Mobile, Título da Plataforma & Indicador Master -->
    <div class="flex min-w-0 items-center gap-3">
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition md:hidden cursor-pointer"
        title="Abrir menu"
        @click="emit('abrir-menu')"
      >
        <AppIcon name="menu" size="20" />
      </button>

      <div class="flex min-w-0 items-center gap-2">
        <img src="/logo-header.png" alt="SeuPercurso" class="h-7 w-auto shrink-0" />
        <span class="hidden shrink-0 items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-2xs sm:flex">
          <AppIcon name="crown" size="12" /> MASTER ADMIN
        </span>
      </div>
    </div>

    <!-- Direita: Sininho, Engrenagem e Avatar -->
    <div class="flex shrink-0 items-center gap-1.5 sm:gap-3">
      <!-- 🔔 1. Sininho de Notificações -->
      <div class="relative">
        <button
          type="button"
          class="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          title="Notificações"
          @click="alternarNotificacoes"
        >
          <AppIcon name="bell" size="18" />
          <span v-if="naoLidas > 0" class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-xs">
            {{ naoLidas }}
          </span>
        </button>

        <!-- Dropdown de Notificações -->
        <div v-if="notificacoesAbertas" class="absolute right-0 mt-3 w-[calc(100vw-1.5rem)] max-w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl z-50">
          <div class="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
            <div class="flex items-center gap-2">
              <span class="flex items-center gap-1.5 font-black text-xs text-slate-900"><AppIcon name="bell" size="14" /> Notificações</span>
              <span v-if="naoLidas > 0" class="rounded-full bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5">
                {{ naoLidas }} {{ naoLidas === 1 ? 'nova' : 'novas' }}
              </span>
            </div>
            <button
              v-if="naoLidas > 0"
              type="button"
              class="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              @click="marcarTodasLidas"
            >
              Marcar como lidas
            </button>
          </div>

          <div v-if="notificacoes.length === 0" class="p-8 text-center text-xs text-slate-400 space-y-1">
            <AppIcon name="bell" size="28" class="mx-auto text-slate-300" />
            <p class="font-bold text-slate-700">Nenhuma comissão recebida ainda</p>
            <p class="text-[11px] text-slate-400">Cada pagamento aprovado aparece aqui na hora.</p>
          </div>

          <div v-else class="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            <div
              v-for="n in notificacoes"
              :key="n.id"
              class="flex items-start gap-3 p-4"
              :class="new Date(n.criadoEm).getTime() > vistasAte ? 'bg-emerald-50/50' : ''"
            >
              <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <AppIcon name="card" size="16" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-xs font-black text-slate-900">Comissão recebida: {{ formatarMoeda(n.valorTaxa) }}</p>
                  <span class="text-[10px] font-semibold text-slate-400 whitespace-nowrap">{{ tempoRelativo(n.criadoEm) }}</span>
                </div>
                <p class="mt-0.5 text-[11px] text-slate-500">Pagamento de {{ formatarMoeda(n.valorTotal) }} aprovado</p>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
            <NuxtLink to="/logs" class="text-[11px] font-bold text-slate-600 hover:text-slate-900" @click="notificacoesAbertas = false">
              Ver logs do sistema
            </NuxtLink>
            <button
              type="button"
              class="text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              title="Toca o som e mostra o alerta só neste aparelho"
              @click="dispararTesteNotificacao"
            >
              Testar alerta neste aparelho
            </button>
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
          <AppIcon name="settings" size="18" />
        </button>

        <!-- Dropdown de Configurações Master -->
        <div v-if="configuracoesAbertas" class="absolute right-0 mt-3 w-[calc(100vw-1.5rem)] max-w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl z-50 space-y-4">
          <div class="border-b border-slate-100 pb-3">
            <h4 class="flex items-center gap-1.5 font-black text-xs text-slate-900"><AppIcon name="settings" size="14" /> Configurações Master</h4>
            <p class="text-[11px] text-slate-500">Parâmetros globais do sistema</p>
          </div>

          <div class="space-y-3 text-xs">
            <NuxtLink to="/configuracoes" class="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50/80 hover:bg-blue-100 transition text-blue-900 font-bold border border-blue-200" @click="configuracoesAbertas = false">
              <AppIcon name="users" size="16" class="text-blue-600" /> Gerenciar Administradores
            </NuxtLink>
            <NuxtLink to="/financeiro" class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition text-slate-800 font-bold" @click="configuracoesAbertas = false">
              <AppIcon name="card" size="16" class="text-slate-500" /> Financeiro e comissões
            </NuxtLink>
            <NuxtLink to="/organizadores" class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition text-slate-800 font-bold" @click="configuracoesAbertas = false">
              <AppIcon name="shield" size="16" class="text-slate-500" /> Aprovação de organizadores
            </NuxtLink>
            <NuxtLink to="/logs" class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition text-slate-800 font-bold" @click="configuracoesAbertas = false">
              <AppIcon name="logs" size="16" class="text-slate-500" /> Logs do sistema
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- 👤 3. Badge do Perfil do Usuário com Nome (Aalan Alves) e Avatar -->
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 hover:bg-slate-100 transition shadow-2xs sm:pr-3.5"
          @click="perfilAberto = !perfilAberto; notificacoesAbertas = false; configuracoesAbertas = false"
        >
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 font-black text-xs text-white shadow-xs">
            {{ iniciais }}
          </div>
          <div class="hidden text-left leading-tight sm:block">
            <span class="block text-xs font-black text-slate-900">
              {{ user?.nome || 'Administrador' }}
            </span>
            <span class="block text-[10px] font-semibold text-slate-400">
              {{ user?.email || '' }}
            </span>
          </div>
          <span class="hidden text-xs text-slate-400 sm:inline">▾</span>
        </button>

        <!-- Dropdown de Ações do Perfil -->
        <div v-if="perfilAberto" class="absolute right-0 mt-3 w-[calc(100vw-1.5rem)] max-w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50">
          <div class="p-3 border-b border-slate-100 text-xs">
            <p class="font-black text-slate-900">{{ user?.nome || 'Administrador' }}</p>
            <p class="text-[11px] text-slate-500 font-mono">{{ user?.email || '' }}</p>
            <span class="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              <AppIcon name="crown" size="11" /> Administrador Master
            </span>
          </div>
          <NuxtLink
            to="/configuracoes"
            class="w-full mt-1 text-left px-3 py-2 text-xs font-bold text-slate-700 rounded-xl hover:bg-slate-100 transition flex items-center gap-2"
            @click="perfilAberto = false"
          >
            <AppIcon name="settings" size="16" class="text-slate-500" /> Configurações & Admins
          </NuxtLink>
          <button
            type="button"
            class="w-full mt-1 text-left px-3 py-2 text-xs font-bold text-red-600 rounded-xl hover:bg-red-50 transition flex items-center gap-2"
            @click="onSair"
          >
            <AppIcon name="logout" size="16" /> Sair da Conta
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
