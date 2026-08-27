<script setup lang="ts">
const props = defineProps<{ aberto?: boolean }>()
const emit = defineEmits<{ fechar: [] }>()

const { user, logout } = useAuth()

const iniciais = computed(() => (user.value?.email || '?').slice(0, 2).toUpperCase())

async function onLogout() {
  logout()
  await navigateTo('/login')
}

const linkClasse = 'flex items-center gap-2 rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100'
</script>

<template>
  <div
    v-if="props.aberto"
    class="fixed inset-0 z-40 bg-black/40 md:hidden"
    @click="emit('fechar')"
  ></div>

  <aside
    class="fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:translate-x-0 md:pointer-events-auto"
    :class="props.aberto ? 'translate-x-0 pointer-events-auto shadow-2xl' : '-translate-x-full pointer-events-none'"
  >
    <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-5">
      <div class="leading-tight">
        <img src="/logo-header.png" alt="SeuPercurso" class="h-8 w-auto" />
        <p class="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Admin</p>
      </div>
      <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 md:hidden" @click="emit('fechar')">
        <AppIcon name="close" size="18" />
      </button>
    </div>

    <nav class="flex-1 space-y-1 px-3 py-4 text-sm font-semibold">
      <NuxtLink to="/dashboard" :class="linkClasse" active-class="bg-warning/10 text-primary font-bold" @click="emit('fechar')">
        <AppIcon name="dashboard" size="18" class="text-slate-500" /> Dashboard
      </NuxtLink>
      <NuxtLink to="/organizadores" :class="linkClasse" active-class="bg-warning/10 text-primary font-bold" @click="emit('fechar')">
        <AppIcon name="organizadores" size="18" class="text-slate-500" /> Organizadores
      </NuxtLink>
      <NuxtLink to="/eventos" :class="linkClasse" active-class="bg-warning/10 text-primary font-bold" @click="emit('fechar')">
        <AppIcon name="eventos" size="18" class="text-slate-500" /> Eventos
      </NuxtLink>
      <NuxtLink to="/financeiro" :class="linkClasse" active-class="bg-warning/10 text-primary font-bold" @click="emit('fechar')">
        <AppIcon name="financeiro" size="18" class="text-slate-500" /> Financeiro
      </NuxtLink>
      <NuxtLink to="/arte" :class="linkClasse" active-class="bg-warning/10 text-primary font-bold" @click="emit('fechar')">
        <AppIcon name="palette" size="18" class="text-slate-500" /> Arte de Eventos
      </NuxtLink>
      <NuxtLink to="/logs" :class="linkClasse" active-class="bg-warning/10 text-primary font-bold" @click="emit('fechar')">
        <AppIcon name="logs" size="18" class="text-slate-500" /> Logs do Sistema
      </NuxtLink>
      <NuxtLink to="/precificacao" :class="linkClasse" active-class="bg-warning/10 text-primary font-bold" @click="emit('fechar')">
        <AppIcon name="tag" size="18" class="text-slate-500" /> Precificação
      </NuxtLink>
    </nav>
  </aside>
</template>
