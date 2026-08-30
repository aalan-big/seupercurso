<script setup lang="ts">
import { ArrowLeft, Search, Camera, ZoomIn, FileText, Percent } from 'lucide-vue-next'
import type { OrganizadorAdmin } from '../../composables/useAdminOrganizadores'

const route = useRoute()
const config = useRuntimeConfig()
const { buscar, aprovar, rejeitar, suspender, atualizarComissao } = useAdminOrganizadores()

const organizador = ref<OrganizadorAdmin | null>(null)
const carregando = ref(true)
const processando = ref(false)
const erro = ref('')
const sucesso = ref('')

const mostrarMotivo = ref<'rejeitar' | 'suspender' | null>(null)
const motivo = ref('')

const editandoComissao = ref(false)
const novaComissao = ref(10)
const salvandoComissao = ref(false)

function abrirEdicaoComissao() {
  if (!organizador.value) return
  novaComissao.value = Number(organizador.value.comissaoPercentual)
  editandoComissao.value = true
}

async function salvarComissao() {
  if (!organizador.value) return
  if (novaComissao.value < 0 || novaComissao.value > 100) {
    erro.value = 'A comissão deve ser entre 0% e 100%.'
    return
  }
  erro.value = ''
  sucesso.value = ''
  salvandoComissao.value = true
  try {
    organizador.value = await atualizarComissao(route.params.id as string, novaComissao.value)
    sucesso.value = `Comissão atualizada para ${novaComissao.value}%.`
    editandoComissao.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvandoComissao.value = false
  }
}

async function carregar() {
  erro.value = ''
  carregando.value = true
  try {
    organizador.value = await buscar(route.params.id as string)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

const fotoRostoUrl = computed(() => urlFoto(organizador.value?.fotoRostoUrl, config.public.apiBase as string))

const documentoUrl = computed(() => urlFoto(organizador.value?.documentoIdentidadeUrl, config.public.apiBase as string))

const ehPdf = computed(() => documentoUrl.value?.toLowerCase().endsWith('.pdf'))

const nomeExibicao = computed(() => {
  if (!organizador.value) return ''
  return organizador.value.cliente.pf?.nomeCompleto || organizador.value.cliente.pj?.razaoSocial || organizador.value.cliente.usuario.email
})

const endereco = computed(() => organizador.value?.cliente.enderecos[0])

async function onAprovar() {
  erro.value = ''
  sucesso.value = ''
  processando.value = true
  try {
    organizador.value = await aprovar(route.params.id as string)
    sucesso.value = 'Organizador aprovado.'
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processando.value = false
  }
}

function abrirMotivo(acao: 'rejeitar' | 'suspender') {
  mostrarMotivo.value = acao
  motivo.value = ''
}

async function confirmarMotivo() {
  if (!mostrarMotivo.value) return
  erro.value = ''
  sucesso.value = ''
  processando.value = true
  try {
    if (mostrarMotivo.value === 'rejeitar') {
      organizador.value = await rejeitar(route.params.id as string, motivo.value || undefined)
      sucesso.value = 'Organizador rejeitado.'
    } else {
      organizador.value = await suspender(route.params.id as string, motivo.value || undefined)
      sucesso.value = 'Organizador suspenso.'
    }
    mostrarMotivo.value = null
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    processando.value = false
  }
}
</script>

<template>
  <div>
    <NuxtLink to="/organizadores" class="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:underline">
      <ArrowLeft :size="16" /> Voltar
    </NuxtLink>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <template v-else-if="organizador">
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 class="min-w-0 break-words text-2xl font-extrabold tracking-tight text-primary">{{ nomeExibicao }}</h1>
        <span class="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
          {{ organizador.status }}
        </span>
      </div>
      <p class="text-sm text-slate-500">{{ organizador.cliente.usuario.email }}</p>

      <p v-if="organizador.motivoRevisao" class="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span class="font-semibold">Motivo registrado:</span> {{ organizador.motivoRevisao }}
      </p>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Dados cadastrais</h2>

          <dl v-if="organizador.cliente.pf" class="mt-3 space-y-2 text-sm">
            <div><dt class="inline font-semibold text-slate-500">Nome:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pf.nomeCompleto }}</dd></div>
            <div><dt class="inline font-semibold text-slate-500">CPF:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pf.cpf }}</dd></div>
            <div><dt class="inline font-semibold text-slate-500">Nascimento:</dt> <dd class="inline text-slate-700">{{ new Date(organizador.cliente.pf.dataNascimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) }}</dd></div>
            <div><dt class="inline font-semibold text-slate-500">Celular:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pf.celular }}</dd></div>
          </dl>

          <dl v-else-if="organizador.cliente.pj" class="mt-3 space-y-2 text-sm">
            <div><dt class="inline font-semibold text-slate-500">Razão social:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pj.razaoSocial }}</dd></div>
            <div v-if="organizador.cliente.pj.nomeFantasia"><dt class="inline font-semibold text-slate-500">Nome fantasia:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pj.nomeFantasia }}</dd></div>
            <div><dt class="inline font-semibold text-slate-500">CNPJ:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pj.cnpj }}</dd></div>
            <div><dt class="inline font-semibold text-slate-500">Responsável:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pj.nomeResponsavel }} ({{ organizador.cliente.pj.documentoResponsavel }})</dd></div>
            <div><dt class="inline font-semibold text-slate-500">Celular comercial:</dt> <dd class="inline text-slate-700">{{ organizador.cliente.pj.celularComercial }}</dd></div>
          </dl>

          <p v-else class="mt-3 text-sm text-slate-400">Perfil PF/PJ ainda não preenchido.</p>

          <div v-if="endereco" class="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
            {{ endereco.logradouro }}, {{ endereco.numero }} — {{ endereco.bairro }}, {{ endereco.cidade }}/{{ endereco.estado }} — {{ endereco.cep }}
          </div>

          <!-- Comissão da Plataforma (editável) -->
          <div class="mt-4 border-t border-slate-100 pt-4">
            <h3 class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              <Percent :size="14" /> Comissão da Plataforma
            </h3>
            <p class="mt-1 text-[11px] text-slate-400">
              Use uma % menor (ou 0%) pra dar desconto de boas-vindas a um organizador novo, por exemplo no primeiro evento dele.
            </p>

            <div v-if="!editandoComissao" class="mt-2 flex items-center gap-3">
              <span class="text-xl font-black text-slate-900">{{ Number(organizador.comissaoPercentual) }}%</span>
              <button
                type="button"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100"
                @click="abrirEdicaoComissao"
              >
                Alterar
              </button>
            </div>

            <div v-else class="mt-2 flex flex-wrap items-center gap-2">
              <div class="relative">
                <input
                  v-model.number="novaComissao"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  class="w-28 rounded-lg border border-slate-300 py-1.5 pl-3 pr-7 text-sm font-bold focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                />
                <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
              <button
                type="button"
                :disabled="salvandoComissao"
                class="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-95 disabled:opacity-50"
                @click="salvarComissao"
              >
                {{ salvandoComissao ? 'Salvando...' : 'Salvar' }}
              </button>
              <button
                type="button"
                class="rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
                @click="editandoComissao = false"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>

        <!-- Verificação KYC (Selfie vs Documento Oficial) -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 class="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-slate-500">
            <Search :size="16" /> Verificação de Identidade (KYC)
          </h2>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- 1. Selfie / Foto do Rosto -->
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between">
              <span class="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase text-slate-600">
                <Camera :size="14" /> Foto do Rosto (Selfie)
              </span>
              <div v-if="!fotoRostoUrl" class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                Foto do rosto não enviada.
              </div>
              <a v-else :href="fotoRostoUrl" target="_blank" rel="noopener" class="block text-center">
                <img :src="fotoRostoUrl" alt="Foto do Rosto (Selfie)" class="max-h-56 w-full rounded-lg border border-slate-200 object-cover" />
                <span class="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"><ZoomIn :size="12" /> Ampliar Selfie</span>
              </a>
            </div>

            <!-- 2. Documento de Identidade -->
            <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col justify-between">
              <span class="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase text-slate-600">
                <FileText :size="14" /> Documento Oficial (RG/CNH)
              </span>
              <div v-if="!documentoUrl" class="rounded-lg border border-dashed border-slate-300 p-6 text-center text-xs text-slate-400">
                Documento oficial não enviado.
              </div>
              <a v-else-if="ehPdf" :href="documentoUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 p-4 text-center text-xs font-bold text-blue-600 hover:underline">
                <FileText :size="14" /> Abrir Documento em PDF
              </a>
              <a v-else :href="documentoUrl" target="_blank" rel="noopener" class="block text-center">
                <img :src="documentoUrl" alt="Documento de Identidade" class="max-h-56 w-full rounded-lg border border-slate-200 object-contain" />
                <span class="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"><ZoomIn :size="12" /> Ampliar Documento</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-wrap gap-2">
        <button
          v-if="organizador.status !== 'APROVADO'"
          type="button"
          :disabled="processando"
          class="rounded-xl bg-accent px-4 py-2 text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-95 disabled:opacity-50"
          @click="onAprovar"
        >
          Aprovar
        </button>
        <button
          v-if="organizador.status !== 'REJEITADO'"
          type="button"
          :disabled="processando"
          class="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold uppercase tracking-wide text-red-600 transition hover:bg-red-50 disabled:opacity-50"
          @click="abrirMotivo('rejeitar')"
        >
          Rejeitar
        </button>
        <button
          v-if="organizador.status === 'APROVADO'"
          type="button"
          :disabled="processando"
          class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          @click="abrirMotivo('suspender')"
        >
          Suspender
        </button>
      </div>

      <div v-if="mostrarMotivo" class="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label class="mb-1 block text-sm font-semibold text-slate-700">
          Motivo {{ mostrarMotivo === 'rejeitar' ? 'da rejeição' : 'da suspensão' }} (opcional, o organizador vê essa mensagem)
        </label>
        <textarea
          v-model="motivo"
          rows="3"
          class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        ></textarea>
        <div class="mt-3 flex gap-2">
          <button
            type="button"
            :disabled="processando"
            class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
            @click="confirmarMotivo"
          >
            Confirmar
          </button>
          <button
            type="button"
            class="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
            @click="mostrarMotivo = null"
          >
            Cancelar
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
