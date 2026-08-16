<script setup lang="ts">
import type { EventoAdmin } from '../../composables/useAdminEventos'

const route = useRoute()
const config = useRuntimeConfig()
const { buscar, aprovar, rejeitar } = useAdminEventos()

const evento = ref<EventoAdmin | null>(null)
const carregando = ref(true)
const processando = ref(false)
const erro = ref('')
const sucesso = ref('')

const mostrarMotivo = ref(false)
const motivo = ref('')

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    evento.value = await buscar(route.params.id as string)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

function urlMidia(caminho: string | null) {
  return caminho ? `${config.public.apiBase}${caminho}` : null
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function nomeOrganizador() {
  if (!evento.value) return ''
  const cliente = evento.value.organizador.cliente
  return cliente.pf?.nomeCompleto || cliente.pj?.razaoSocial || cliente.usuario.email
}

async function onAprovar() {
  erro.value = ''
  sucesso.value = ''
  processando.value = true
  try {
    evento.value = await aprovar(route.params.id as string)
    sucesso.value = 'Evento publicado.'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processando.value = false
  }
}

async function confirmarRejeicao() {
  erro.value = ''
  sucesso.value = ''
  processando.value = true
  try {
    evento.value = await rejeitar(route.params.id as string, motivo.value || undefined)
    sucesso.value = 'Evento rejeitado — voltou pra rascunho.'
    mostrarMotivo.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processando.value = false
  }
}
</script>

<template>
  <div>
    <NuxtLink to="/eventos" class="text-sm font-semibold text-secondary hover:underline">← Voltar</NuxtLink>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="evento">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-extrabold tracking-tight text-primary">{{ evento.nome }}</h1>
        <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          {{ evento.status }}
        </span>
      </div>
      <p class="text-sm text-slate-500">Organizador: {{ nomeOrganizador() }}</p>

      <p v-if="evento.motivoRejeicao" class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span class="font-semibold">Motivo da última rejeição:</span> {{ evento.motivoRejeicao }}
      </p>

      <div class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Dados do evento</h2>
        <dl class="mt-3 space-y-2 text-sm">
          <div><dt class="inline font-semibold text-slate-500">Local:</dt> <dd class="inline text-slate-700">{{ evento.local }} — {{ evento.cidade }}/{{ evento.estado }}</dd></div>
          <div><dt class="inline font-semibold text-slate-500">Data:</dt> <dd class="inline text-slate-700">{{ formatarData(evento.dataInicio) }} até {{ formatarData(evento.dataFim) }}</dd></div>
          <div v-if="evento.capacidade"><dt class="inline font-semibold text-slate-500">Capacidade:</dt> <dd class="inline text-slate-700">{{ evento.capacidade }} vagas</dd></div>
          <div v-if="evento.modalidades.length"><dt class="inline font-semibold text-slate-500">Modalidades:</dt> <dd class="inline text-slate-700">{{ evento.modalidades.map((m) => `${m.nome} (${m.distanciaKm}km)`).join(', ') }}</dd></div>
        </dl>
        <p v-if="evento.descricao" class="mt-3 whitespace-pre-line text-sm text-slate-600">{{ evento.descricao }}</p>

        <div v-if="urlMidia(evento.bannerUrl)" class="mt-4">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Banner</p>
          <img :src="urlMidia(evento.bannerUrl)!" alt="Banner do evento" class="max-h-64 rounded-lg border border-slate-200 object-contain" />
        </div>

        <a
          v-if="urlMidia(evento.regulamentoUrl)"
          :href="urlMidia(evento.regulamentoUrl)!"
          target="_blank"
          rel="noopener"
          class="mt-4 inline-block text-sm font-semibold text-secondary hover:underline"
        >
          📄 Ver regulamento
        </a>
      </div>

      <div v-if="evento.status === 'AGUARDANDO_APROVACAO'" class="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          :disabled="processando"
          class="rounded-xl bg-accent px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-95 disabled:opacity-50"
          @click="onAprovar"
        >
          Aprovar e publicar
        </button>
        <button
          type="button"
          :disabled="processando"
          class="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold uppercase tracking-wide text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          @click="mostrarMotivo = true; motivo = ''"
        >
          Rejeitar
        </button>
      </div>
      <p v-else class="mt-6 text-sm text-slate-400">
        Esse evento não está aguardando revisão no momento.
      </p>

      <div v-if="mostrarMotivo" class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label class="mb-1 block text-sm font-semibold text-slate-700">Motivo da rejeição (o organizador vê essa mensagem)</label>
        <textarea
          v-model="motivo"
          rows="3"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        ></textarea>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            :disabled="processando"
            class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
            @click="confirmarRejeicao"
          >
            Confirmar rejeição
          </button>
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
            @click="mostrarMotivo = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
