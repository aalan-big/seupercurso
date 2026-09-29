<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Timer,
  Plus,
  RefreshCw,
  Search,
  Building2,
  Calendar,
  UserCheck,
  UserX,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  Check,
  X,
  Users,
  Activity,
  Key,
} from 'lucide-vue-next'
import {
  useAdminCronometragem,
  type CronometradoraAdmin,
  type UsuarioCronometradora,
} from '~/composables/useAdminCronometragem'

const {
  empresas,
  solicitacoes,
  auditorias,
  fetchEmpresas,
  criarEmpresa,
  renovarAssinatura,
  alterarStatus,
  vincularUsuario,
  atualizarUsuario,
  fetchSolicitacoes,
  fetchAuditoria,
} = useAdminCronometragem()

const abaAtiva = ref<'empresas' | 'pedidos' | 'auditoria'>('empresas')
const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')
const busca = ref('')

// =========================================================================
// MODAIS
// =========================================================================
const modalCriar = ref(false)
const formCriar = ref({
  nome: '',
  documento: '',
  plano: 'Cronometragem anual',
  assinaturaValidaAte: '',
})

const modalRenovar = ref<CronometradoraAdmin | null>(null)
const tipoRenovacao = ref<'ano' | 'meses' | 'data'>('ano')
const novaDataPersonalizada = ref('')

const modalVincular = ref<CronometradoraAdmin | null>(null)
const formVincular = ref<{
  email: string
  papel: 'ADMIN' | 'OPERADOR'
}>({
  email: '',
  papel: 'OPERADOR',
})

const processandoModal = ref(false)
const erroModal = ref('')

onMounted(async () => {
  await carregarTudo()
})

async function carregarTudo() {
  carregando.value = true
  erro.value = ''
  try {
    await Promise.all([
      fetchEmpresas(),
      fetchSolicitacoes(),
      fetchAuditoria(),
    ])
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
}

// -------------------------------------------------------------------------
// CRIAR CRONOMETRADORA
// -------------------------------------------------------------------------
function abrirModalCriar() {
  const dataHojeMaisUmAno = new Date()
  dataHojeMaisUmAno.setFullYear(dataHojeMaisUmAno.getFullYear() + 1)
  const anoStr = dataHojeMaisUmAno.toISOString().slice(0, 10)

  formCriar.value = {
    nome: '',
    documento: '',
    plano: 'Cronometragem anual',
    assinaturaValidaAte: anoStr,
  }
  erroModal.value = ''
  modalCriar.value = true
}

async function onSubmeterCriar() {
  if (!formCriar.value.nome.trim()) {
    erroModal.value = 'Nome da empresa é obrigatório.'
    return
  }
  processandoModal.value = true
  erroModal.value = ''
  try {
    await criarEmpresa({
      nome: formCriar.value.nome.trim(),
      documento: formCriar.value.documento.trim() || undefined,
      plano: formCriar.value.plano.trim() || undefined,
      assinaturaValidaAte: formCriar.value.assinaturaValidaAte || undefined,
    })
    sucesso.value = 'Empresa cronometradora criada com sucesso!'
    modalCriar.value = false
  } catch (e) {
    erroModal.value = extrairErro(e)
  } finally {
    processandoModal.value = false
  }
}

// -------------------------------------------------------------------------
// RENOVAR ASSINATURA
// -------------------------------------------------------------------------
function abrirModalRenovar(empresa: CronometradoraAdmin) {
  modalRenovar.value = empresa
  tipoRenovacao.value = 'ano'
  novaDataPersonalizada.value = ''
  erroModal.value = ''
}

async function onSubmeterRenovar() {
  if (!modalRenovar.value) return
  processandoModal.value = true
  erroModal.value = ''
  try {
    if (tipoRenovacao.value === 'ano') {
      await renovarAssinatura(modalRenovar.value.id, { dias: 365 })
    } else if (tipoRenovacao.value === 'meses') {
      await renovarAssinatura(modalRenovar.value.id, { dias: 180 })
    } else {
      if (!novaDataPersonalizada.value) {
        erroModal.value = 'Selecione uma data de validade.'
        processandoModal.value = false
        return
      }
      await renovarAssinatura(modalRenovar.value.id, { novaData: novaDataPersonalizada.value })
    }
    sucesso.value = `Assinatura de "${modalRenovar.value.nome}" renovada com sucesso!`
    modalRenovar.value = null
  } catch (e) {
    erroModal.value = extrairErro(e)
  } finally {
    processandoModal.value = false
  }
}

// -------------------------------------------------------------------------
// BLOQUEAR / ATIVAR EMPRESA
// -------------------------------------------------------------------------
async function onAlternarStatusEmpresa(empresa: CronometradoraAdmin) {
  const novoStatus = empresa.status === 'ATIVA' ? 'BLOQUEADA' : 'ATIVA'
  const acaoNome = novoStatus === 'ATIVA' ? 'reativar' : 'bloquear'
  if (!confirm(`Tem certeza que deseja ${acaoNome} a empresa "${empresa.nome}"?`)) return

  erro.value = ''
  sucesso.value = ''
  try {
    await alterarStatus(empresa.id, novoStatus)
    sucesso.value = `Empresa "${empresa.nome}" foi ${novoStatus === 'ATIVA' ? 'reativada' : 'bloqueada'}.`
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

// -------------------------------------------------------------------------
// VINCULAR USUÁRIO POR E-MAIL
// -------------------------------------------------------------------------
function abrirModalVincular(empresa: CronometradoraAdmin) {
  modalVincular.value = empresa
  formVincular.value = {
    email: '',
    papel: 'OPERADOR',
  }
  erroModal.value = ''
}

async function onSubmeterVincular() {
  if (!modalVincular.value) return
  if (!formVincular.value.email.trim()) {
    erroModal.value = 'Informe o e-mail do usuário.'
    return
  }
  processandoModal.value = true
  erroModal.value = ''
  try {
    await vincularUsuario(modalVincular.value.id, {
      email: formVincular.value.email.trim(),
      papel: formVincular.value.papel,
    })
    sucesso.value = `Usuário "${formVincular.value.email}" vinculado com sucesso!`
    modalVincular.value = null
  } catch (e) {
    erroModal.value = extrairErro(e)
  } finally {
    processandoModal.value = false
  }
}

async function onAlternarAtivoUsuario(usuarioVinculo: UsuarioCronometradora) {
  try {
    await atualizarUsuario(usuarioVinculo.usuarioId, {
      ativo: !usuarioVinculo.ativo,
    })
    sucesso.value = `Status do operador atualizado com sucesso.`
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

async function onDesvincularUsuario(usuarioVinculo: UsuarioCronometradora) {
  if (!confirm(`Deseja remover o vínculo do usuário "${usuarioVinculo.usuario.email}" desta cronometradora?`)) return
  try {
    await atualizarUsuario(usuarioVinculo.usuarioId, {
      desvincular: true,
    })
    sucesso.value = `Vínculo removido com sucesso.`
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

// -------------------------------------------------------------------------
// FILTROS E FORMATAÇÃO
// -------------------------------------------------------------------------
const empresasFiltradas = computed(() => {
  if (!busca.value.trim()) return empresas.value
  const q = busca.value.toLowerCase().trim()
  return empresas.value.filter((emp) => {
    const nome = emp.nome.toLowerCase()
    const doc = emp.documento?.toLowerCase() || ''
    const usuarios = emp.usuarios.map((u) => u.usuario.email.toLowerCase()).join(' ')
    return nome.includes(q) || doc.includes(q) || usuarios.includes(q)
  })
})

function formatarData(isoStr?: string | null) {
  if (!isoStr) return '--'
  try {
    return new Date(isoStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return isoStr
  }
}

function formatarDataHora(isoStr?: string | null) {
  if (!isoStr) return '--'
  try {
    return new Date(isoStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

function ehVencida(isoStr: string) {
  try {
    return new Date(isoStr) < new Date()
  } catch {
    return false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho Principal -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary flex items-center gap-2">
          <span>⏱️</span> Cronometragem (SeuPercurso Mark)
        </h1>
        <p class="mt-1 text-sm text-slate-500">
          Gerenciamento de empresas de cronometragem, licenças anuais, operadores vinculados e auditoria.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 shadow-2xs"
          @click="carregarTudo"
        >
          <RefreshCw :size="14" /> Atualizar
        </button>

        <button
          type="button"
          class="rounded-xl bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:brightness-95 transition flex items-center gap-1.5 shadow-2xs"
          @click="abrirModalCriar"
        >
          <Plus :size="15" /> Nova Cronometradora
        </button>
      </div>
    </div>

    <!-- Navegação por Abas -->
    <div class="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1">
      <button
        type="button"
        class="flex-1 rounded-xl py-2 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
        :class="abaAtiva === 'empresas' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        @click="abaAtiva = 'empresas'"
      >
        <Building2 :size="15" /> Empresas & Licenças ({{ empresas.length }})
      </button>

      <button
        type="button"
        class="flex-1 rounded-xl py-2 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
        :class="abaAtiva === 'pedidos' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        @click="abaAtiva = 'pedidos'"
      >
        <ShieldCheck :size="15" /> Pedidos de Acesso ({{ solicitacoes.length }})
      </button>

      <button
        type="button"
        class="flex-1 rounded-xl py-2 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
        :class="abaAtiva === 'auditoria' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'"
        @click="abaAtiva = 'auditoria'"
      >
        <Activity :size="15" /> Auditoria de Acessos ({{ auditorias.length }})
      </button>
    </div>

    <!-- Feedback Geral -->
    <div v-if="sucesso" class="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <CheckCircle :size="14" class="text-emerald-600 shrink-0" />
        <span>{{ sucesso }}</span>
      </div>
      <button type="button" class="text-emerald-600 hover:text-emerald-900" @click="sucesso = ''">✕</button>
    </div>

    <div v-if="erro" class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <AlertTriangle :size="14" class="text-red-600 shrink-0" />
        <span>{{ erro }}</span>
      </div>
      <button type="button" class="text-red-600 hover:text-red-900" @click="erro = ''">✕</button>
    </div>

    <!-- =================================================================== -->
    <!-- ABA 1: EMPRESAS & LICENÇAS                                         -->
    <!-- =================================================================== -->
    <div v-if="abaAtiva === 'empresas'" class="space-y-4">
      <!-- Barra de Busca -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1 max-w-md">
          <Search :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="busca"
            type="text"
            placeholder="Buscar por nome, documento ou e-mail de operador..."
            class="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-primary focus:outline-hidden shadow-2xs"
          />
        </div>
      </div>

      <div v-if="carregando" class="py-12 text-center text-xs text-slate-400 font-bold">
        Carregando empresas de cronometragem...
      </div>

      <div v-else-if="empresasFiltradas.length === 0" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Nenhuma empresa de cronometragem encontrada.
      </div>

      <!-- Grid de Empresas -->
      <div v-else class="grid grid-cols-1 gap-4">
        <div
          v-for="emp in empresasFiltradas"
          :key="emp.id"
          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 hover:border-slate-300 transition"
        >
          <!-- Cabeçalho do Card -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-extrabold text-slate-900">{{ emp.nome }}</h3>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  :class="emp.status === 'ATIVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'"
                >
                  {{ emp.status }}
                </span>
                <span
                  v-if="ehVencida(emp.assinaturaValidaAte)"
                  class="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                >
                  Assinatura Vencida
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                Documento: <span class="font-mono text-slate-600">{{ emp.documento || 'Não informado' }}</span> •
                Plano: <span class="font-semibold text-slate-600">{{ emp.plano }}</span>
              </p>
            </div>

            <!-- Botões de Ação do Card -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                @click="abrirModalRenovar(emp)"
              >
                Renovar Licença
              </button>
              <button
                type="button"
                class="rounded-xl border px-3 py-1.5 text-xs font-bold transition"
                :class="emp.status === 'ATIVA' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'"
                @click="onAlternarStatusEmpresa(emp)"
              >
                {{ emp.status === 'ATIVA' ? 'Bloquear' : 'Desbloquear' }}
              </button>
            </div>
          </div>

          <!-- Métricas e Validade -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-xl p-3 text-xs">
            <div>
              <span class="text-slate-400 font-bold uppercase text-[10px]">Validade da Licença</span>
              <p class="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                <Calendar :size="13" class="text-slate-500" />
                {{ formatarData(emp.assinaturaValidaAte) }}
              </p>
            </div>

            <div>
              <span class="text-slate-400 font-bold uppercase text-[10px]">Operadores Vinculados</span>
              <p class="font-bold text-slate-800 mt-0.5">{{ emp.usuarios.length }} usuário(s)</p>
            </div>

            <div>
              <span class="text-slate-400 font-bold uppercase text-[10px]">Solicitações de Provas</span>
              <p class="font-bold text-slate-800 mt-0.5">{{ emp._count.solicitacoes }} pedido(s)</p>
            </div>

            <div>
              <span class="text-slate-400 font-bold uppercase text-[10px]">Passagens Registradas</span>
              <p class="font-bold text-slate-800 mt-0.5">{{ emp._count.passagens }} leitura(s)</p>
            </div>
          </div>

          <!-- Seção de Usuários / Operadores Vinculados -->
          <div class="space-y-2 pt-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users :size="13" /> Usuários com Acesso ao Mark:
              </span>
              <button
                type="button"
                class="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                @click="abrirModalVincular(emp)"
              >
                <Plus :size="13" /> Vincular Usuário por E-mail
              </button>
            </div>

            <div v-if="emp.usuarios.length === 0" class="text-xs text-slate-400 italic bg-white border border-dashed border-slate-200 rounded-xl p-3 text-center">
              Nenhum operador vinculado a esta empresa. Vincule um e-mail para permitir o login no SeuPercurso Mark.
            </div>

            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="u in emp.usuarios"
                :key="u.usuarioId"
                class="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-2xs"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <p class="truncate font-bold text-slate-900">{{ u.usuario.email }}</p>
                    <span class="rounded bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[10px] font-black uppercase">
                      {{ u.papel }}
                    </span>
                  </div>
                  <p class="text-[11px] text-slate-400 truncate mt-0.5">
                    {{ u.usuario.cliente?.pf?.nomeCompleto || u.usuario.cliente?.pj?.razaoSocial || 'Sem nome cadastrado' }}
                  </p>
                </div>

                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    class="rounded-lg p-1 text-xs font-bold transition"
                    :class="u.ativo ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'"
                    :title="u.ativo ? 'Usuário ativo. Clique para suspender.' : 'Usuário inativo. Clique para ativar.'"
                    @click="onAlternarAtivoUsuario(u)"
                  >
                    <UserCheck v-if="u.ativo" :size="14" />
                    <UserX v-else :size="14" />
                  </button>

                  <button
                    type="button"
                    class="rounded-lg p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    title="Remover vínculo"
                    @click="onDesvincularUsuario(u)"
                  >
                    <X :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- ABA 2: PEDIDOS DE ACESSO A PROVAS                                   -->
    <!-- =================================================================== -->
    <div v-if="abaAtiva === 'pedidos'" class="space-y-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div>
          <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Histórico de Pedidos de Acesso</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Solicitações enviadas pelas empresas aos organizadores para download de inscritos e sincronização de passagens.
          </p>
        </div>

        <div v-if="solicitacoes.length === 0" class="py-12 text-center text-xs text-slate-400">
          Nenhuma solicitação registrada no sistema.
        </div>

        <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4">Cronometradora</th>
                <th class="py-3 px-4">Prova / Evento</th>
                <th class="py-3 px-4">Organizador</th>
                <th class="py-3 px-4">Mensagem do Pedido</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Válido Até</th>
                <th class="py-3 px-4">Data do Pedido</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 font-medium text-slate-700">
              <tr v-for="sol in solicitacoes" :key="sol.id" class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-bold text-slate-900">{{ sol.cronometradora.nome }}</td>
                <td class="py-3 px-4 font-bold text-primary">
                  {{ sol.evento.nome }}
                  <span class="text-[11px] font-normal text-slate-400 block">({{ sol.evento.cidade }}/{{ sol.evento.estado }})</span>
                </td>
                <td class="py-3 px-4 text-slate-600">
                  {{ sol.evento.organizador?.cliente?.pf?.nomeCompleto || sol.evento.organizador?.cliente?.pj?.nomeFantasia || 'Organizador' }}
                </td>
                <td class="py-3 px-4 max-w-xs truncate" :title="sol.mensagem">{{ sol.mensagem }}</td>
                <td class="py-3 px-4">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    :class="{
                      'bg-amber-100 text-amber-800': sol.status === 'PENDENTE',
                      'bg-emerald-100 text-emerald-800': sol.status === 'APROVADA',
                      'bg-red-100 text-red-800': sol.status === 'RECUSADA',
                      'bg-slate-200 text-slate-700': sol.status === 'REVOGADA',
                      'bg-zinc-100 text-zinc-500': sol.status === 'EXPIRADA',
                    }"
                  >
                    {{ sol.status }}
                  </span>
                </td>
                <td class="py-3 px-4 whitespace-nowrap">{{ formatarData(sol.validaAte) }}</td>
                <td class="py-3 px-4 whitespace-nowrap text-slate-400">{{ formatarDataHora(sol.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- ABA 3: AUDITORIA DE ACESSOS                                        -->
    <!-- =================================================================== -->
    <div v-if="abaAtiva === 'auditoria'" class="space-y-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div>
          <h2 class="text-sm font-bold text-slate-900 uppercase tracking-wider">Trilha de Auditoria (LGPD & Segurança)</h2>
          <p class="text-xs text-slate-500 mt-0.5">
            Registro automático de aprovações, recusas, revogações e downloads de inscritos.
          </p>
        </div>

        <div v-if="auditorias.length === 0" class="py-12 text-center text-xs text-slate-400">
          Nenhum registro de auditoria até o momento.
        </div>

        <div v-else class="overflow-x-auto rounded-xl border border-slate-200">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 border-b border-slate-200 font-extrabold text-slate-500 uppercase tracking-wider">
              <tr>
                <th class="py-3 px-4">Data / Hora</th>
                <th class="py-3 px-4">Cronometradora</th>
                <th class="py-3 px-4">Ação</th>
                <th class="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 font-medium text-slate-700">
              <tr v-for="aud in auditorias" :key="aud.id" class="hover:bg-slate-50 transition">
                <td class="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">{{ formatarDataHora(aud.createdAt) }}</td>
                <td class="py-3 px-4 font-bold text-slate-900">{{ aud.cronometradora.nome }}</td>
                <td class="py-3 px-4">
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    :class="{
                      'bg-emerald-100 text-emerald-800': aud.acao === 'aprovou',
                      'bg-red-100 text-red-800': aud.acao === 'recusou',
                      'bg-amber-100 text-amber-800': aud.acao === 'revogou',
                      'bg-blue-100 text-blue-800': aud.acao === 'BAIXOU_INSCRITOS',
                    }"
                  >
                    {{ aud.acao }}
                  </span>
                </td>
                <td class="py-3 px-4 text-slate-600">{{ aud.detalhe || '--' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: CRIAR CRONOMETRADORA                                         -->
    <!-- =================================================================== -->
    <div
      v-if="modalCriar"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900">Cadastrar Empresa Cronometradora</h3>
          <button type="button" class="text-slate-400 hover:text-slate-600" @click="modalCriar = false">✕</button>
        </div>

        <div v-if="erroModal" class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
          {{ erroModal }}
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Nome da Empresa / Fantasia *:</label>
            <input
              v-model="formCriar.nome"
              type="text"
              placeholder="Ex: Sport Timing Cronometragem"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">CNPJ ou CPF (opcional):</label>
            <input
              v-model="formCriar.documento"
              type="text"
              placeholder="00.000.000/0000-00"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Nome do Plano:</label>
            <input
              v-model="formCriar.plano"
              type="text"
              placeholder="Cronometragem anual"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Validade Inicial da Assinatura:</label>
            <input
              v-model="formCriar.assinaturaValidaAte"
              type="date"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            :disabled="processandoModal"
            @click="modalCriar = false"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:brightness-95 transition disabled:opacity-50"
            :disabled="processandoModal"
            @click="onSubmeterCriar"
          >
            {{ processandoModal ? 'Salvando...' : 'Salvar Empresa' }}
          </button>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: RENOVAR ASSINATURA                                           -->
    <!-- =================================================================== -->
    <div
      v-if="modalRenovar"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900">Renovar Licença Anual</h3>
          <button type="button" class="text-slate-400 hover:text-slate-600" @click="modalRenovar = null">✕</button>
        </div>

        <p class="text-xs text-slate-500">
          Empresa: <strong>{{ modalRenovar.nome }}</strong> • Válida atualmente até: <strong>{{ formatarData(modalRenovar.assinaturaValidaAte) }}</strong>
        </p>

        <div v-if="erroModal" class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
          {{ erroModal }}
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-bold text-slate-700">Selecione o período de extensão:</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              class="rounded-xl border p-2 text-xs font-bold text-center transition"
              :class="tipoRenovacao === 'ano' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-300 text-slate-700 hover:bg-slate-50'"
              @click="tipoRenovacao = 'ano'"
            >
              + 1 Ano (365d)
            </button>
            <button
              type="button"
              class="rounded-xl border p-2 text-xs font-bold text-center transition"
              :class="tipoRenovacao === 'meses' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-300 text-slate-700 hover:bg-slate-50'"
              @click="tipoRenovacao = 'meses'"
            >
              + 6 Meses (180d)
            </button>
            <button
              type="button"
              class="rounded-xl border p-2 text-xs font-bold text-center transition"
              :class="tipoRenovacao === 'data' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-300 text-slate-700 hover:bg-slate-50'"
              @click="tipoRenovacao = 'data'"
            >
              Data Exata
            </button>
          </div>
        </div>

        <div v-if="tipoRenovacao === 'data'" class="space-y-1">
          <label class="block text-xs font-bold text-slate-700">Nova data de expiração:</label>
          <input
            v-model="novaDataPersonalizada"
            type="date"
            class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            :disabled="processandoModal"
            @click="modalRenovar = null"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:brightness-95 transition disabled:opacity-50"
            :disabled="processandoModal"
            @click="onSubmeterRenovar"
          >
            {{ processandoModal ? 'Renovando...' : 'Confirmar Renovação' }}
          </button>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- MODAL: VINCULAR USUÁRIO POR E-MAIL                                  -->
    <!-- =================================================================== -->
    <div
      v-if="modalVincular"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-slate-900">Vincular Usuário / Operador</h3>
          <button type="button" class="text-slate-400 hover:text-slate-600" @click="modalVincular = null">✕</button>
        </div>

        <p class="text-xs text-slate-500">
          Empresa: <strong>{{ modalVincular.nome }}</strong>
        </p>

        <div v-if="erroModal" class="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
          {{ erroModal }}
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">E-mail do Usuário no SeuPercurso *:</label>
            <input
              v-model="formVincular.email"
              type="email"
              placeholder="operador@cronometragem.com"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:bg-white focus:border-primary focus:outline-hidden"
            />
            <p class="text-[11px] text-slate-400 mt-1">
              O usuário deve estar previamente cadastrado na plataforma SeuPercurso com este e-mail.
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">Papel na Cronometradora:</label>
            <select
              v-model="formVincular.papel"
              class="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-800 font-bold focus:bg-white focus:border-primary focus:outline-hidden"
            >
              <option value="OPERADOR">OPERADOR (Pode buscar provas e sincronizar passagens)</option>
              <option value="ADMIN">ADMIN (Acesso completo aos dados da empresa)</option>
            </select>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            :disabled="processandoModal"
            @click="modalVincular = null"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="rounded-xl bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:brightness-95 transition disabled:opacity-50"
            :disabled="processandoModal"
            @click="onSubmeterVincular"
          >
            {{ processandoModal ? 'Vinculando...' : 'Confirmar Vínculo' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
