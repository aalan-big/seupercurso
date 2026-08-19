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
    class="fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 md:static md:translate-x-0"
    :class="props.aberto ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="flex items-center justify-between gap-2 border-b border-slate-200 px-6 py-5">
      <div class="flex items-center gap-2">
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base text-white">🛡️</span>
        <div class="leading-tight">
          <p class="text-lg font-extrabold tracking-tight text-primary">
            Seu<span class="text-warning">Percurso</span>
          </p>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Admin</p>
        </div>
      </div>
      <button type="button" class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 md:hidden" @click="emit('fechar')">
        ✕
      </button>
    </div>

    <nav class="flex-1 space-y-1 px-3 py-4 text-sm font-semibold">
      <NuxtLink to="/dashboard" :class="linkClasse" active-class="bg-accent/10 text-primary" @click="emit('fechar')">
        <span>📊</span> Dashboard
      </NuxtLink>
      <NuxtLink to="/organizadores" :class="linkClasse" active-class="bg-accent/10 text-primary" @click="emit('fechar')">
        <span>🧑‍💼</span> Organizadores
      </NuxtLink>
      <NuxtLink to="/eventos" :class="linkClasse" active-class="bg-accent/10 text-primary" @click="emit('fechar')">
        <span>📅</span> Eventos
      </NuxtLink>
      <NuxtLink to="/financeiro" :class="linkClasse" active-class="bg-accent/10 text-primary" @click="emit('fechar')">
        <span>💰</span> Financeiro
      </NuxtLink>
      <NuxtLink to="/logs" :class="linkClasse" active-class="bg-accent/10 text-primary" @click="emit('fechar')">
        <span>📜</span> Logs do Sistema
      </NuxtLink>
    </nav>
  </aside>
</template>
