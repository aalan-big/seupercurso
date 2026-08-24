<script setup lang="ts">
const { token } = useAuth()
const { organizador, fetchMe } = useOrganizador()

const verificando = ref(true)
const menuAberto = ref(false)

const route = useRoute()

const mostrarBanner = computed(() => {
  if (verificando.value || !organizador.value || organizador.value.status === 'APROVADO') return false
  return route.path !== '/verificacao'
})

let statusInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login')
    return
  }

  try {
    await fetchMe()
  } catch {
    token.value = null
    await navigateTo('/login')
    return
  }

  verificando.value = false

  // Polling automático a cada 4s enquanto não estiver APROVADO para atualizar assim que o Admin aprovar
  statusInterval = setInterval(async () => {
    if (organizador.value?.status !== 'APROVADO') {
      try {
        await fetchMe()
      } catch {}
    }
  }, 4000)
})

onUnmounted(() => {
  if (statusInterval) clearInterval(statusInterval)
})

</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-50 w-full max-w-full">
    <AppSidebar :aberto="menuAberto" @fechar="menuAberto = false" />

    <div class="flex min-h-0 flex-1 flex-col min-w-0 max-w-full overflow-x-hidden">
      <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shrink-0">
        <div class="flex items-center gap-3 md:hidden">
          <button type="button" class="rounded-lg p-1 text-slate-600 hover:bg-slate-100 transition" @click="menuAberto = true">
            <AppIcon name="menu" size="22" class="text-slate-700" />
          </button>
          <span class="text-base font-extrabold tracking-tight text-primary">
            Seu<span class="text-warning">Percurso</span>
          </span>
        </div>
        <div class="hidden md:block"></div>
        <AppTopbarMenu />
      </div>

      <!-- Banner de Alerta KYC se o Organizador não estiver aprovado (oculto na página de verificação) -->
      <div
        v-if="mostrarBanner"
        class="bg-amber-500 text-amber-950 px-4 py-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-bold shrink-0"
      >
        <div class="flex items-center gap-2">
          <AppIcon name="warning" size="18" class="text-amber-950 shrink-0" />
          <span v-if="!organizador.fotoRostoUrl || !organizador.documentoIdentidadeUrl">
            Seu cadastro de organizador está pendente. Envie a sua selfie e documento oficial para liberar a criação de eventos.
          </span>
          <span v-else>
            Seus documentos foram enviados com sucesso e estão em análise pela Administração Master.
          </span>
        </div>

        <NuxtLink
          to="/verificacao"
          class="rounded-xl bg-slate-900 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-white shadow-xs hover:bg-black transition shrink-0 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <AppIcon v-if="!organizador.fotoRostoUrl || !organizador.documentoIdentidadeUrl" name="camera" size="14" class="text-amber-400" />
          <AppIcon v-else name="documento" size="14" class="text-amber-400" />
          <span>{{ (!organizador.fotoRostoUrl || !organizador.documentoIdentidadeUrl) ? 'Enviar Selfie e Documentos' : 'Ver Status dos Documentos' }}</span>
        </NuxtLink>
      </div>

      <main class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 w-full max-w-full">
        <slot v-if="!verificando" />
      </main>
    </div>
  </div>
</template>


