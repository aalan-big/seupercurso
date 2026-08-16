<script setup lang="ts">
const { token, user, fetchMe, logout } = useAuth()
const { cliente, fetchMe: fetchClienteMe } = useCliente()
const config = useRuntimeConfig()

const organizerBase = config.public.organizerBase as string

const menuAberto = ref(false)
const menuRef = ref<HTMLElement | null>(null)

const fotoUrl = computed(() => urlFoto(cliente.value?.fotoPerfil, config.public.apiBase as string))

const nomeExibido = computed(() => {
  const nome = cliente.value?.pf?.nomeCompleto
  if (!nome) return user.value?.email || ''
  const partes = nome.trim().split(/\s+/)
  return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0]
})

const iniciais = computed(() => {
  const nome = cliente.value?.pf?.nomeCompleto
  if (!nome) return (user.value?.email || '?').slice(0, 2).toUpperCase()
  const partes = nome.trim().split(/\s+/)
  const primeira = partes[0]?.[0] || ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return (primeira + ultima).toUpperCase()
})

onMounted(async () => {
  if (token.value && !user.value) {
    try {
      await fetchMe()
    } catch {
      logout()
    }
  }
  if (token.value && !cliente.value) {
    try {
      await fetchClienteMe()
    } catch {
      // perfil de atleta ainda não completado — mantém o e-mail como fallback
    }
  }
  document.addEventListener('click', onClickFora)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickFora)
})

function onClickFora(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    menuAberto.value = false
  }
}

async function onLogout() {
  menuAberto.value = false
  logout()
  await navigateTo('/')
}
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <NuxtLink to="/" class="flex items-center gap-2 text-xl font-extrabold tracking-tight">
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-base text-white">🏃</span>
        <span class="text-primary">Seu<span class="text-warning">Percurso</span></span>
      </NuxtLink>

      <nav class="hidden gap-6 text-sm font-semibold uppercase tracking-wide text-slate-600 sm:flex">
        <NuxtLink to="/" class="hover:text-secondary">Eventos</NuxtLink>
        <NuxtLink to="/#eventos" class="hover:text-secondary">Inscrições</NuxtLink>
        <NuxtLink to="/sobre" class="hover:text-secondary">Sobre</NuxtLink>
        <NuxtLink to="/blog" class="hover:text-secondary">Blog</NuxtLink>
        <NuxtLink to="/contato" class="hover:text-secondary">Contato</NuxtLink>
      </nav>

      <div v-if="token" ref="menuRef" class="relative">
        <button
          class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          @click="menuAberto = !menuAberto"
        >
          <span class="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-bold text-white">
            <img v-if="fotoUrl" :src="fotoUrl" alt="" class="h-full w-full object-cover" />
            <template v-else>{{ iniciais }}</template>
          </span>
          <span class="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 sm:inline">
            {{ nomeExibido }}
          </span>
          <span class="text-xs text-slate-400 transition-transform" :class="menuAberto ? 'rotate-180' : ''">▾</span>
        </button>

        <div
          v-if="menuAberto"
          class="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <NuxtLink
            to="/perfil"
            class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            @click="menuAberto = false"
          >
            Meu perfil
          </NuxtLink>
          <NuxtLink
            to="/minhas-inscricoes"
            class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            @click="menuAberto = false"
          >
            Minhas inscrições
          </NuxtLink>
          <div class="my-1 border-t border-slate-100"></div>
          <button class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50" @click="onLogout">
            Sair
          </button>
        </div>
      </div>
      <div v-else class="flex items-center gap-2">
        <NuxtLink to="/login" class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Login Atleta
        </NuxtLink>
        <NuxtLink to="/cadastro" class="hidden rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-block">
          Cadastre-se
        </NuxtLink>
        <a
          :href="organizerBase"
          class="rounded-lg bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95"
        >
          Criar evento
        </a>
      </div>
    </div>
  </header>
</template>
