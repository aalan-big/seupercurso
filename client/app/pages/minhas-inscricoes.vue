<script setup lang="ts">
const { token } = useAuth()
const { minhasInscricoes, fetchMinhas, cancelar } = useInscricao()

const carregando = ref(true)
const erro = ref('')

const confirmandoId = ref<string | null>(null)
const cancelandoId = ref<string | null>(null)
const erroCancelar = ref('')

onMounted(async () => {
  if (!token.value) {
    await navigateTo('/login?redirect=/minhas-inscricoes')
    return
  }
  try {
    await fetchMinhas()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusInfo: Record<string, { texto: string; classe: string }> = {
  PENDENTE_PAGAMENTO: { texto: 'Pagamento pendente', classe: 'bg-warning/10 text-warning' },
  CONFIRMADA: { texto: 'Confirmada', classe: 'bg-accent/10 text-accent' },
  CANCELADA: { texto: 'Cancelada', classe: 'bg-red-50 text-red-600' },
  EXPIRADA: { texto: 'Expirada', classe: 'bg-slate-100 text-slate-500' }
}

async function confirmarCancelamento(id: string) {
  erroCancelar.value = ''
  cancelandoId.value = id
  try {
    await cancelar(id)
    confirmandoId.value = null
  } catch (e) {
    erroCancelar.value = extrairErro(e)
  } finally {
    cancelandoId.value = null
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12">
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Minhas inscrições</h1>
    <p class="mt-1 text-sm text-slate-500">Acompanhe suas inscrições em eventos.</p>

    <p v-if="carregando" class="mt-8 text-sm text-slate-500">Carregando...</p>

    <p v-else-if="erro" class="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <div v-else-if="minhasInscricoes.length === 0" class="mt-10 text-center">
      <div class="text-4xl">🏁</div>
      <p class="mt-3 text-slate-500">Você ainda não se inscreveu em nenhum evento.</p>
      <NuxtLink
        to="/#eventos"
        class="mt-6 inline-block rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95"
      >
        Ver eventos disponíveis
      </NuxtLink>
    </div>

    <div v-else class="mt-8 flex flex-col gap-4">
      <div
        v-for="inscricao in minhasInscricoes"
        :key="inscricao.id"
        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-bold text-slate-800">{{ inscricao.categoria.modalidade.evento.nome }}</p>
            <p class="mt-1 text-sm text-slate-500">
              {{ inscricao.categoria.modalidade.nome }} · {{ inscricao.categoria.nome }}
            </p>
            <p class="mt-1 text-xs text-slate-400">Inscrito em {{ formatarData(inscricao.dataInscricao) }}</p>
          </div>
          <span
            class="whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            :class="statusInfo[inscricao.status]?.classe || 'bg-slate-100 text-slate-500'"
          >
            {{ statusInfo[inscricao.status]?.texto || inscricao.status }}
          </span>
        </div>

        <div v-if="inscricao.status === 'PENDENTE_PAGAMENTO'" class="mt-4 border-t border-slate-100 pt-4">
          <p v-if="erroCancelar && confirmandoId === inscricao.id" class="mb-3 text-sm text-red-600">
            {{ erroCancelar }}
          </p>

          <div v-if="confirmandoId === inscricao.id" class="flex items-center gap-3">
            <span class="text-sm text-slate-600">Cancelar essa inscrição?</span>
            <button
              type="button"
              :disabled="cancelandoId === inscricao.id"
              class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-red-700 disabled:opacity-50"
              @click="confirmarCancelamento(inscricao.id)"
            >
              {{ cancelandoId === inscricao.id ? 'Cancelando...' : 'Sim, cancelar' }}
            </button>
            <button
              type="button"
              class="text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
              @click="confirmandoId = null"
            >
              Voltar
            </button>
          </div>
          <button
            v-else
            type="button"
            class="text-xs font-bold uppercase tracking-wide text-red-600 hover:text-red-700"
            @click="confirmandoId = inscricao.id"
          >
            Cancelar inscrição
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
