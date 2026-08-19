<script setup lang="ts">
import type { EventoAdmin } from '../../composables/useAdminEventos'

const route = useRoute()
const config = useRuntimeConfig()
const { buscar, aprovar, rejeitar, suspender } = useAdminEventos()

const evento = ref<EventoAdmin | null>(null)
const carregando = ref(true)
const processando = ref(false)
const erro = ref('')
const sucesso = ref('')

const mostrarMotivoRejeicao = ref(false)
const mostrarMotivoSuspensao = ref(false)
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
    sucesso.value = 'Evento aprovado e publicado no portal com sucesso.'
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
    sucesso.value = 'Evento rejeitado — voltou para rascunho.'
    mostrarMotivoRejeicao.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processando.value = false
  }
}

async function confirmarSuspensao() {
  erro.value = ''
  sucesso.value = ''
  processando.value = true
  try {
    evento.value = await suspender(route.params.id as string, motivo.value || undefined)
    sucesso.value = '🛑 Evento BARRADO/SUSPENSO com sucesso. Novas inscrições foram bloqueadas.'
    mostrarMotivoSuspensao.value = false
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

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{{ sucesso }}</p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="evento">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-extrabold tracking-tight text-primary">{{ evento.nome }}</h1>
        <span
          class="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide"
          :class="evento.status === 'SUSPENSO' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'"
        >
          {{ evento.status === 'SUSPENSO' ? '🛑 BARRADO / SUSPENSO' : evento.status }}
        </span>
      </div>
      <p class="text-sm text-slate-500">Organizador: {{ nomeOrganizador() }}</p>

      <p v-if="evento.motivoRejeicao" class="mt-4 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm text-red-800">
        <span class="font-bold">Motivo da rejeição/suspensão:</span> {{ evento.motivoRejeicao }}
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

      <!-- Ações do Administrador Master -->
      <div class="mt-6 flex flex-wrap gap-3">
        <button
          v-if="evento.status !== 'PUBLICADO'"
          type="button"
          :disabled="processando"
          class="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-50 shadow-xs"
          @click="onAprovar"
        >
          🟢 {{ evento.status === 'SUSPENSO' ? 'Desbloquear & Publicar' : 'Aprovar & Publicar' }}
        </button>

        <button
          v-if="evento.status !== 'SUSPENSO'"
          type="button"
          :disabled="processando"
          class="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-700 disabled:opacity-50 shadow-xs"
          @click="mostrarMotivoSuspensao = true; mostrarMotivoRejeicao = false; motivo = ''"
        >
          🛑 Barrar / Suspender Evento
        </button>

        <button
          v-if="evento.status === 'AGUARDANDO_APROVACAO'"
          type="button"
          :disabled="processando"
          class="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          @click="mostrarMotivoRejeicao = true; mostrarMotivoSuspensao = false; motivo = ''"
        >
          Devolver para Rascunho
        </button>
      </div>

      <!-- Modal de Barrar / Suspender -->
      <div v-if="mostrarMotivoSuspensao" class="mt-4 rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm space-y-3">
        <label class="block text-xs font-black uppercase text-red-900">Motivo para Barrar/Suspender este Evento</label>
        <textarea
          v-model="motivo"
          rows="3"
          placeholder="Ex: Divergência na documentação do local / Denúncia de irregularidade..."
          class="w-full rounded-xl border border-red-300 p-3 text-xs focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
        ></textarea>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="processando"
            class="rounded-xl bg-red-600 px-4 py-2 text-xs font-black uppercase text-white transition hover:bg-red-700 disabled:opacity-50"
            @click="confirmarSuspensao"
          >
            Confirmar Suspensão
          </button>
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-100"
            @click="mostrarMotivoSuspensao = false"
          >
            Cancelar
          </button>
        </div>
      </div>

      <!-- Modal de Devolver para Rascunho -->
      <div v-if="mostrarMotivoRejeicao" class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <label class="block text-xs font-bold uppercase text-slate-700">Motivo da devolução (o organizador visualiza essa mensagem)</label>
        <textarea
          v-model="motivo"
          rows="3"
          class="w-full rounded-xl border border-slate-300 p-3 text-xs focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        ></textarea>
        <div class="flex gap-2">
          <button
            type="button"
            :disabled="processando"
            class="rounded-xl bg-warning px-4 py-2 text-xs font-black uppercase text-primary transition hover:brightness-95 disabled:opacity-50"
            @click="confirmarRejeicao"
          >
            Confirmar Rejeição
          </button>
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-xs font-bold uppercase text-slate-500 hover:bg-slate-100"
            @click="mostrarMotivoRejeicao = false"
          >
            Cancelar
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
