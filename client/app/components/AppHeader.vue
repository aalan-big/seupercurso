<script setup lang="ts">
import { BarChart2, Trophy, X, Menu } from 'lucide-vue-next'

const { token, user, fetchMe, logout } = useAuth()
const { cliente, fetchMe: fetchClienteMe } = useCliente()
const { organizador, fetchMe: fetchOrganizadorMe } = useOrganizador()
const config = useRuntimeConfig()

const organizerBase = computed(() => {
  let base = config.public.organizerBase as string
  if (import.meta.client && window.location.hostname && base.includes('localhost')) {
    base = base.replace('localhost', window.location.hostname)
  }
  return base
})

const organizerLink = computed(() => {
  const tokenParam = token.value ? `?token=${encodeURIComponent(token.value)}` : ''
  if (organizador.value?.status === 'APROVADO') {
    return `${organizerBase.value}/dashboard${tokenParam}`
  }
  if (token.value) {
    return `${organizerBase.value}/onboarding${tokenParam}`
  }
  return `${organizerBase.value}/cadastro`
})

const verificandoOrganizador = ref(true)

const organizerMenuLabel = computed(() => {
  if (verificandoOrganizador.value) return '...'
  if (organizador.value?.status === 'APROVADO') return 'Painel do Organizador'
  if (organizador.value) return 'Status do Cadastro de Organizador'
  return 'Quero ser Organizador'
})

const organizerMenuIcon = computed(() => (organizador.value ? BarChart2 : Trophy))

const menuAberto = ref(false)

const menuRef = ref<HTMLElement | null>(null)
const menuMobileAberto = ref(false)

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

async function carregarDadosUsuario() {
  if (!token.value) {
    verificandoOrganizador.value = false
    return
  }

  verificandoOrganizador.value = true

  const tarefas: Promise<unknown>[] = [
    fetchClienteMe().catch(() => {
      // perfil de atleta ainda não completado — mantém o e-mail como fallback
    }),
    fetchOrganizadorMe().catch(() => {
      // conta ainda não solicitou cadastro de organizador
    })
  ]

  // fetchMe só é chamado se ainda não temos os dados do usuário: logo após
  // login/cadastro eles já vêm prontos na resposta, então refazer essa
  // chamada aqui é redundante e arriscado — uma falha passageira aqui não
  // pode derrubar um login que acabou de funcionar.
  if (!user.value) {
    tarefas.push(fetchMe().catch(() => logout()))
  }

  await Promise.all(tarefas)
  verificandoOrganizador.value = false
}

// Re-executa sempre que o login/logout acontece dentro da mesma sessão (SPA),
// já que este header só monta uma vez e não refletiria a mudança sozinho.
watch(token, () => {
  carregarDadosUsuario()
})

onMounted(() => {
  carregarDadosUsuario()
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
  cliente.value = null
  organizador.value = null
  await navigateTo('/')
}
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
      <NuxtLink to="/" class="flex items-center gap-2">
        <img src="/logo-header.png" alt="SeuPercurso" class="h-8 w-auto sm:h-9" />
      </NuxtLink>

      <nav class="hidden gap-6 text-sm font-semibold uppercase tracking-wide text-slate-600 sm:flex">
        <NuxtLink to="/" class="hover:text-warning">Eventos</NuxtLink>
        <NuxtLink v-if="token" to="/meus-eventos" class="hover:text-warning">Meus Eventos</NuxtLink>
        <NuxtLink to="/sobre" class="hover:text-warning">Sobre</NuxtLink>
        <NuxtLink to="/blog" class="hover:text-warning">Blog</NuxtLink>
        <NuxtLink to="/contato" class="hover:text-warning">Contato</NuxtLink>
      </nav>

      <div class="flex items-center gap-2">
        <div v-if="token" ref="menuRef" class="relative hidden sm:block">
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
            class="absolute right-0 top-full z-20 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
          >
            <NuxtLink
              to="/perfil"
              class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              @click="menuAberto = false"
            >
              Meu perfil
            </NuxtLink>
            <NuxtLink
              to="/meus-eventos"
              class="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              @click="menuAberto = false"
            >
              Meus Eventos
            </NuxtLink>
            <div class="my-1 border-t border-slate-100"></div>
            <a
              :href="organizerLink"
              target="_blank"
              class="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 transition"
              @click="menuAberto = false"
            >
              <component :is="organizerMenuIcon" :size="14" /> {{ organizerMenuLabel }}
            </a>
            <div class="my-1 border-t border-slate-100"></div>
            <button class="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50" @click="onLogout">
              Sair
            </button>
          </div>
        </div>

        <div v-else class="flex items-center gap-1.5">
          <NuxtLink to="/login" class="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
            Login
          </NuxtLink>
          <NuxtLink to="/cadastro" class="hidden rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 sm:inline-block">
            Cadastre-se
          </NuxtLink>
          <a
            :href="organizerBase"
            class="hidden sm:inline-block rounded-lg bg-warning px-3.5 py-1.5 text-xs font-black uppercase tracking-wide text-primary shadow transition hover:brightness-95"
          >
            Criar evento
          </a>
        </div>

        <button
          type="button"
          class="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 sm:hidden"
          aria-label="Menu"
          @click="menuMobileAberto = !menuMobileAberto"
        >
          <X v-if="menuMobileAberto" :size="20" />
          <Menu v-else :size="20" />
        </button>
      </div>
    </div>

    <div v-if="menuMobileAberto" class="border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
      <nav class="flex flex-col gap-1 text-sm font-semibold uppercase tracking-wide text-slate-600">
        <NuxtLink to="/" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Eventos</NuxtLink>
        <NuxtLink v-if="token" to="/meus-eventos" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Meus Eventos</NuxtLink>
        <NuxtLink to="/sobre" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Sobre</NuxtLink>
        <NuxtLink to="/blog" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Blog</NuxtLink>
        <NuxtLink to="/contato" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Contato</NuxtLink>
      </nav>

      <div class="my-2 border-t border-slate-100"></div>

      <div v-if="token" class="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <NuxtLink to="/perfil" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Meu perfil</NuxtLink>
        <NuxtLink to="/meus-eventos" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Meus Eventos</NuxtLink>
        <a :href="organizerLink" target="_blank" class="flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-2 font-bold text-amber-900 hover:bg-amber-100" @click="menuMobileAberto = false"><component :is="organizerMenuIcon" :size="14" /> {{ organizerMenuLabel }}</a>
        <button type="button" class="rounded-lg px-2 py-2 text-left text-red-600 hover:bg-red-50" @click="onLogout(); menuMobileAberto = false">Sair</button>
      </div>
      <div v-else class="flex flex-col gap-1 text-sm font-medium text-slate-700">
        <NuxtLink to="/cadastro" class="rounded-lg px-2 py-2 hover:bg-slate-100" @click="menuMobileAberto = false">Cadastre-se</NuxtLink>
        <a :href="organizerBase" class="rounded-lg px-2 py-2 font-bold uppercase tracking-wide text-warning hover:bg-slate-100">Criar evento</a>
      </div>
    </div>
  </header>
</template>
