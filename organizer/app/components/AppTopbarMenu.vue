<script setup lang="ts">
const { logout } = useAuth()
const { cliente, fetchMe, uploadFoto } = useCliente()
const config = useRuntimeConfig()

const aberto = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const fotoInputRef = ref<HTMLInputElement | null>(null)
const enviandoFoto = ref(false)
const erroFoto = ref('')

onMounted(async () => {
  document.addEventListener('click', aoClicarFora)
  if (!cliente.value) {
    try {
      await fetchMe()
    } catch {
      // organizador ainda sem perfil de cliente completo — sem problema, mostra iniciais/ícone padrão
    }
  }
})
onUnmounted(() => document.removeEventListener('click', aoClicarFora))

const fotoUrl = computed(() => urlFoto(cliente.value?.fotoPerfil, config.public.apiBase as string))

function abrirSeletorFoto() {
  fotoInputRef.value?.click()
}

async function onFotoSelecionada(e: Event) {
  const input = e.target as HTMLInputElement
  const arquivo = input.files?.[0]
  if (!arquivo) return

  erroFoto.value = ''

  if (!arquivo.type.startsWith('image/')) {
    erroFoto.value = 'Envie um arquivo de imagem.'
    input.value = ''
    return
  }
  if (arquivo.size > 5 * 1024 * 1024) {
    erroFoto.value = 'A imagem precisa ter até 5MB.'
    input.value = ''
    return
  }

  enviandoFoto.value = true
  try {
    await uploadFoto(arquivo)
  } catch (e) {
    erroFoto.value = extrairErro(e)
  } finally {
    enviandoFoto.value = false
    input.value = ''
  }
}

function alternar() {
  aberto.value = !aberto.value
}

function fechar() {
  aberto.value = false
}

function aoClicarFora(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    fechar()
  }
}

async function onLogout() {
  fechar()
  logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="flex flex-col items-end">
      <button
        type="button"
        class="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-bold text-white shadow-xs"
        :disabled="enviandoFoto"
        title="Trocar foto de perfil"
        @click="abrirSeletorFoto"
      >
        <img v-if="fotoUrl" :src="fotoUrl" alt="Foto de perfil" class="h-full w-full object-cover" />
        <AppIcon v-else name="user" size="18" class="text-slate-300" />
        <span
          class="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
          :class="{ 'opacity-100': enviandoFoto }"
        >
          <AppIcon name="camera" size="14" class="text-white" />
        </span>
      </button>
      <p v-if="erroFoto" class="mt-1 text-[11px] text-red-600 font-semibold">{{ erroFoto }}</p>
    </div>
    <input ref="fotoInputRef" type="file" accept="image/*" class="hidden" @change="onFotoSelecionada" />

    <div ref="containerRef" class="relative">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label="Configurações"
        @click="alternar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      <div
        v-if="aberto"
        class="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 text-xs font-bold shadow-xl"
      >
        <NuxtLink
          to="/configuracoes"
          class="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition"
          @click="fechar"
        >
          <AppIcon name="user" size="16" class="text-slate-500" /> Meus dados
        </NuxtLink>
        <NuxtLink
          to="/verificacao"
          class="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition"
          @click="fechar"
        >
          <AppIcon name="verificacao" size="16" class="text-amber-500" /> Verificação de conta
        </NuxtLink>
        <NuxtLink
          to="/dados-bancarios"
          class="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition"
          @click="fechar"
        >
          <AppIcon name="financeiro" size="16" class="text-slate-500" /> Dados bancários
        </NuxtLink>
        <NuxtLink
          to="/senha"
          class="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition"
          @click="fechar"
        >
          <AppIcon name="lock" size="16" class="text-slate-500" /> Alterar senha
        </NuxtLink>
        <NuxtLink
          to="/equipe"
          class="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition"
          @click="fechar"
        >
          <AppIcon name="inscritos" size="16" class="text-slate-500" /> Minha equipe
        </NuxtLink>
        <div class="my-1 border-t border-slate-100"></div>
        <NuxtLink
          to="/suporte"
          class="flex items-center gap-2.5 px-4 py-2.5 text-slate-700 hover:bg-slate-100 transition"
          @click="fechar"
        >
          <AppIcon name="sparkles" size="16" class="text-slate-500" /> Suporte
        </NuxtLink>
        <button
          type="button"
          class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left font-bold text-red-600 hover:bg-red-50 transition"
          @click="onLogout"
        >
          <AppIcon name="logout" size="16" class="text-red-600" /> Sair da conta
        </button>
      </div>
    </div>
  </div>
</template>

