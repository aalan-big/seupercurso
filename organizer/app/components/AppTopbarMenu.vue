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
        class="group relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-bold text-white"
        :disabled="enviandoFoto"
        title="Trocar foto de perfil"
        @click="abrirSeletorFoto"
      >
        <img v-if="fotoUrl" :src="fotoUrl" alt="Foto de perfil" class="h-full w-full object-cover" />
        <span v-else class="text-base">👤</span>
        <span
          class="absolute inset-0 flex items-center justify-center bg-black/50 text-xs opacity-0 transition-opacity group-hover:opacity-100"
          :class="{ 'opacity-100': enviandoFoto }"
        >
          {{ enviandoFoto ? '...' : '📷' }}
        </span>
      </button>
      <p v-if="erroFoto" class="mt-1 text-[11px] text-red-600">{{ erroFoto }}</p>
    </div>
    <input ref="fotoInputRef" type="file" accept="image/*" class="hidden" @change="onFotoSelecionada" />

    <div ref="containerRef" class="relative">
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-full text-lg text-slate-500 transition hover:bg-slate-100"
      aria-label="Configurações"
      @click="alternar"
    >
      ⚙️
    </button>

    <div
      v-if="aberto"
      class="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg"
    >
      <NuxtLink
        to="/configuracoes"
        class="block px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        @click="fechar"
      >
        Meus dados
      </NuxtLink>
      <NuxtLink
        to="/verificacao"
        class="block px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        @click="fechar"
      >
        Verificação de conta
      </NuxtLink>
      <NuxtLink
        to="/dados-bancarios"
        class="block px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        @click="fechar"
      >
        Dados bancários
      </NuxtLink>
      <NuxtLink
        to="/senha"
        class="block px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        @click="fechar"
      >
        Alterar senha
      </NuxtLink>
      <NuxtLink
        to="/equipe"
        class="block px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        @click="fechar"
      >
        Minha equipe
      </NuxtLink>
      <div class="my-1 border-t border-slate-100"></div>
      <NuxtLink
        to="/suporte"
        class="block px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
        @click="fechar"
      >
        Suporte
      </NuxtLink>
      <button
        type="button"
        class="block w-full px-4 py-2 text-left font-medium text-red-600 hover:bg-red-50"
        @click="onLogout"
      >
        🚪 Sair
      </button>
    </div>
    </div>
  </div>
</template>
