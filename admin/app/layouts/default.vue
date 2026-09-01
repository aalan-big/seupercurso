<script setup lang="ts">
const { token, user, fetchMe } = useAuth()

const verificando = ref(true)
const menuAberto = ref(false)
const toastNotificacao = useState<any>('toastNotificacao', () => null)

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login')
    return
  }

  try {
    if (!user.value) await fetchMe()
  } catch {
    // Sessao invalida ou API fora do ar: limpa o token para o middleware
    // nao devolver a rota para /dashboard e criar um loop de redirect.
    token.value = null
    user.value = null
    await navigateTo('/login')
    return
  }

  verificando.value = false

  const { $notificacoes } = useNuxtApp() as any
  if ($notificacoes) {
    $notificacoes.conectarStream()
    $notificacoes.solicitarPermissao()
  }
})
</script>

<template>
  <div v-if="verificando" class="flex h-screen items-center justify-center bg-slate-50">
    <span class="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary"></span>
  </div>

  <div v-else class="flex h-screen overflow-hidden bg-slate-50 relative">
    <!-- Toast Flutuante de Notificação no Celular / Desktop -->
    <div
      v-if="toastNotificacao"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex w-[90%] max-w-sm items-center gap-3.5 rounded-2xl border-2 border-orange-500 bg-slate-900 p-4 text-white shadow-2xl backdrop-blur-md transition-all duration-300"
    >
      <img src="/icone_notificacao.jpg" alt="Seu Percurso" class="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm border border-orange-400" />
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-black uppercase text-orange-400 tracking-wider">Seu Percurso</h4>
          <span class="text-[10px] font-bold text-slate-400">{{ toastNotificacao.criadoEm }}</span>
        </div>
        <p class="mt-0.5 text-xs font-bold text-slate-100">
          Nova comissão recebida: <span class="font-black text-emerald-400">{{ toastNotificacao.valorFormatado }}</span>
        </p>
      </div>
      <button
        type="button"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold"
        @click="toastNotificacao = null"
      >
        ✕
      </button>
    </div>

    <AppSidebar :aberto="menuAberto" @fechar="menuAberto = false" />

    <div class="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <!-- Menu Superior Header Master -->
      <AppHeader @abrir-menu="menuAberto = true" />

      <main class="min-h-0 w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-8 pb-24 md:pb-8">
        <slot />
      </main>

      <!-- Barra de Navegação Inferior para Celular / PWA (Estilo App Nativo) -->
      <nav class="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden shadow-lg">
        <NuxtLink
          to="/dashboard"
          class="flex flex-1 flex-col items-center justify-center py-1 text-slate-500 hover:text-primary transition"
          active-class="!text-orange-600 font-bold"
        >
          <AppIcon name="dashboard" size="20" />
          <span class="text-[10px] tracking-tight mt-0.5">Início</span>
        </NuxtLink>

        <NuxtLink
          to="/financeiro"
          class="flex flex-1 flex-col items-center justify-center py-1 text-slate-500 hover:text-primary transition relative"
          active-class="!text-orange-600 font-bold"
        >
          <AppIcon name="financeiro" size="20" />
          <span class="text-[10px] tracking-tight mt-0.5">Financeiro</span>
        </NuxtLink>

        <NuxtLink
          to="/organizadores"
          class="flex flex-1 flex-col items-center justify-center py-1 text-slate-500 hover:text-primary transition"
          active-class="!text-orange-600 font-bold"
        >
          <AppIcon name="organizadores" size="20" />
          <span class="text-[10px] tracking-tight mt-0.5">Organizadores</span>
        </NuxtLink>

        <NuxtLink
          to="/eventos"
          class="flex flex-1 flex-col items-center justify-center py-1 text-slate-500 hover:text-primary transition"
          active-class="!text-orange-600 font-bold"
        >
          <AppIcon name="eventos" size="20" />
          <span class="text-[10px] tracking-tight mt-0.5">Eventos</span>
        </NuxtLink>

        <button
          type="button"
          class="flex flex-1 flex-col items-center justify-center py-1 text-slate-500 hover:text-primary transition cursor-pointer"
          @click="menuAberto = true"
        >
          <AppIcon name="menu" size="20" />
          <span class="text-[10px] tracking-tight mt-0.5">Menu</span>
        </button>
      </nav>
    </div>
  </div>
</template>
