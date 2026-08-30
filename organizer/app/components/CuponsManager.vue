<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next'
import type { EventoOrganizador } from '../composables/useEventoOrganizador'

const props = defineProps<{ eventoId: string; evento: EventoOrganizador }>()

const { cupons, fetchCupons, criarCupom, removerCupom } = useCuponsOrganizador()
const { atualizarEvento } = useEventoOrganizador()

const erro = ref('')
const salvando = ref(false)
const carregandoCupons = ref(true)

const descontoIdosoAtivo = ref(props.evento.aplicaDescontoIdoso)
const percentualIdoso = ref(props.evento.percentualDescontoIdoso || '50')
const salvandoIdoso = ref(false)
const sucessoIdoso = ref(false)

onMounted(async () => {
  try {
    await fetchCupons(props.eventoId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregandoCupons.value = false
  }
})

async function onSalvarDescontoIdoso() {
  erro.value = ''
  sucessoIdoso.value = false
  salvandoIdoso.value = true
  try {
    await atualizarEvento(props.eventoId, {
      aplicaDescontoIdoso: descontoIdosoAtivo.value,
      percentualDescontoIdoso: descontoIdosoAtivo.value ? Number(percentualIdoso.value) : undefined
    })
    sucessoIdoso.value = true
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvandoIdoso.value = false
  }
}

const mostrarFormCupom = ref(false)
const novoCupom = reactive({ codigo: '', percentualDesconto: '', quantidadeMaxima: '', validoAte: '' })

async function onCriarCupom() {
  erro.value = ''
  const percentual = Number(novoCupom.percentualDesconto)
  if (!novoCupom.codigo || !percentual) {
    erro.value = 'Informe o código e o percentual de desconto do cupom.'
    return
  }

  salvando.value = true
  try {
    await criarCupom(props.eventoId, {
      codigo: novoCupom.codigo,
      percentualDesconto: percentual,
      quantidadeMaxima: novoCupom.quantidadeMaxima ? Number(novoCupom.quantidadeMaxima) : undefined,
      validoAte: novoCupom.validoAte || undefined
    })
    novoCupom.codigo = ''
    novoCupom.percentualDesconto = ''
    novoCupom.quantidadeMaxima = ''
    novoCupom.validoAte = ''
    mostrarFormCupom.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onRemoverCupom(cupomId: string) {
  erro.value = ''
  try {
    await removerCupom(props.eventoId, cupomId)
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

function formatarData(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <p v-if="erro" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {{ erro }}
    </p>

    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Desconto do idoso</h2>
      <p class="mt-1 text-xs text-slate-400">Aplica desconto automático pra inscritos com 60 anos ou mais na data do evento.</p>

      <label class="mt-4 flex items-center gap-2 text-sm text-slate-700">
        <input v-model="descontoIdosoAtivo" type="checkbox" class="h-4 w-4 rounded border-slate-300 accent-warning focus:ring-warning/30" />
        Aplicar desconto do idoso neste evento
      </label>

      <div v-if="descontoIdosoAtivo" class="mt-3 max-w-xs">
        <label class="mb-1 block text-xs font-semibold text-slate-500">Percentual de desconto</label>
        <div class="flex items-center gap-2">
          <input
            v-model="percentualIdoso"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            class="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
          />
          <span class="text-sm text-slate-500">%</span>
        </div>
      </div>

      <p v-if="sucessoIdoso" class="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2 w-fit">
        <CheckCircle :size="14" class="text-emerald-600" /> Salvo.
      </p>

      <button
        type="button"
        :disabled="salvandoIdoso"
        class="mt-4 rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
        @click="onSalvarDescontoIdoso"
      >
        {{ salvandoIdoso ? 'Salvando...' : 'Salvar' }}
      </button>
    </div>

    <div>
      <h2 class="text-sm font-bold uppercase tracking-wide text-slate-500">Cupons de desconto</h2>
      <p class="mt-1 text-xs text-slate-400">Pra assessorias esportivas e grupos — o atleta informa o código na hora de se inscrever.</p>

      <p v-if="carregandoCupons" class="mt-4 text-sm text-slate-500">Carregando...</p>

      <div v-else-if="cupons.length === 0" class="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        Nenhum cupom cadastrado ainda.
      </div>

      <div v-else class="mt-4 flex flex-col gap-2">
        <div
          v-for="cupom in cupons"
          :key="cupom.id"
          class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
        >
          <div>
            <span class="font-bold text-slate-800">{{ cupom.codigo }}</span>
            <span class="ml-2 text-accent">{{ Number(cupom.percentualDesconto) }}% off</span>
            <span class="ml-2 text-slate-400">
              {{ cupom.usosAtuais }}{{ cupom.quantidadeMaxima ? ` / ${cupom.quantidadeMaxima}` : '' }} usos
              <template v-if="cupom.validoAte"> · válido até {{ formatarData(cupom.validoAte) }}</template>
            </span>
          </div>
          <button
            type="button"
            class="text-xs font-bold uppercase tracking-wide text-red-600 hover:text-red-700"
            @click="onRemoverCupom(cupom.id)"
          >
            Remover
          </button>
        </div>
      </div>

      <div class="mt-4">
        <button
          v-if="!mostrarFormCupom"
          type="button"
          class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
          @click="mostrarFormCupom = true"
        >
          + Novo cupom
        </button>

        <div v-else class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              v-model="novoCupom.codigo"
              type="text"
              placeholder="Código (ex.: ASSESSORIAX)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
            <input
              v-model="novoCupom.percentualDesconto"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              placeholder="Desconto (%)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
            <input
              v-model="novoCupom.quantidadeMaxima"
              type="number"
              min="1"
              placeholder="Limite de usos (opcional)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
            <input
              v-model="novoCupom.validoAte"
              type="date"
              class="min-w-0 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
          </div>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              :disabled="salvando"
              class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
              @click="onCriarCupom"
            >
              {{ salvando ? 'Salvando...' : 'Salvar cupom' }}
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100"
              @click="mostrarFormCupom = false"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
