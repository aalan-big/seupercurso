<script setup lang="ts">
const { organizadores, fetchLista } = useAdminOrganizadores()

const filtro = ref<'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO' | ''>('PENDENTE')
const carregando = ref(true)
const erro = ref('')

const abas = [
  { valor: 'PENDENTE' as const, label: 'Pendentes' },
  { valor: 'APROVADO' as const, label: 'Aprovados' },
  { valor: 'REJEITADO' as const, label: 'Rejeitados' },
  { valor: 'SUSPENSO' as const, label: 'Suspensos' },
  { valor: '' as const, label: 'Todos' }
]

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    await fetchLista(filtro.value || undefined)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

watch(filtro, carregar)
onMounted(carregar)

function nomeExibicao(org: (typeof organizadores.value)[number]) {
  return org.cliente.pf?.nomeCompleto || org.cliente.pj?.razaoSocial || org.cliente.usuario.email
}

const statusClasse: Record<string, string> = {
  PENDENTE: 'bg-warning/10 text-warning',
  APROVADO: 'bg-accent/10 text-accent',
  REJEITADO: 'bg-red-100 text-red-700',
  SUSPENSO: 'bg-slate-200 text-slate-600'
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Organizadores</h1>
    <p class="mt-1 text-sm text-slate-500">Revise os documentos antes de aprovar quem pode organizar eventos.</p>

    <div class="mt-6 flex gap-2 overflow-x-auto pb-1">
      <button
        v-for="aba in abas"
        :key="aba.valor"
        type="button"
        class="shrink-0 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold uppercase tracking-wide transition"
        :class="filtro === aba.valor ? 'border-primary bg-primary text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100'"
        @click="filtro = aba.valor"
      >
        {{ aba.label }}
      </button>
    </div>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <div v-else-if="organizadores.length === 0" class="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
      Nenhum organizador nessa situação.
    </div>

    <div v-else class="mt-6 flex flex-col gap-3">
      <NuxtLink
        v-for="org in organizadores"
        :key="org.id"
        :to="`/organizadores/${org.id}`"
        class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-secondary"
      >
        <div class="min-w-0">
          <p class="truncate font-bold text-slate-800">{{ nomeExibicao(org) }}</p>
          <p class="mt-0.5 truncate text-xs text-slate-400">{{ org.cliente.usuario.email }}</p>
        </div>
        <span
          class="shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
          :class="statusClasse[org.status]"
        >
          {{ org.status }}
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
