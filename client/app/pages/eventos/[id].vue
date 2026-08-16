<script setup lang="ts">
const route = useRoute()
const eventoId = route.params.id as string

const { token } = useAuth()
const { eventoSelecionado, fetchEvento } = useEvento()
const { criar } = useInscricao()
const { cliente, fetchMe: fetchClienteMe } = useCliente()

const carregando = ref(true)
const erro = ref('')

const passos = ['Modalidade', 'Categoria', 'Complementos', 'Revisão']
const step = ref(1)

const modalidadeSelecionadaId = ref<string | null>(null)
const categoriaSelecionadaId = ref<string | null>(null)
const tamanhoCamisa = ref('')
const cupomCodigo = ref('')
const aceiteTermos = ref(false)

const inscrevendo = ref(false)
const erroInscricao = ref('')
const inscricaoCriada = ref<{ valor: string } | null>(null)

const tamanhos = ['PP', 'P', 'M', 'G', 'GG']

onMounted(async () => {
  try {
    await fetchEvento(eventoId)
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }

  if (token.value) {
    try {
      await fetchClienteMe()
    } catch {
      // perfil de atleta ainda não completado — a checagem de elegibilidade fica só no backend nesse caso
    }
  }
})

function calcularIdade(nascimentoIso: string, referenciaIso: string) {
  const nascimento = new Date(nascimentoIso)
  const referencia = new Date(referenciaIso)
  let idade = referencia.getUTCFullYear() - nascimento.getUTCFullYear()
  const aniversarioEsteAno = Date.UTC(referencia.getUTCFullYear(), nascimento.getUTCMonth(), nascimento.getUTCDate())
  if (referencia.getTime() < aniversarioEsteAno) idade -= 1
  return idade
}

function motivoInelegibilidade(categoria: { idadeMinima: number | null; idadeMaxima: number | null; genero: string; pcd: boolean }) {
  const pf = cliente.value?.pf
  if (!pf || !eventoSelecionado.value) return null

  if (categoria.idadeMinima !== null || categoria.idadeMaxima !== null) {
    const idade = calcularIdade(pf.dataNascimento, eventoSelecionado.value.dataInicio)
    if (categoria.idadeMinima !== null && idade < categoria.idadeMinima) {
      return `Idade mínima: ${categoria.idadeMinima} anos`
    }
    if (categoria.idadeMaxima !== null && idade > categoria.idadeMaxima) {
      return `Idade máxima: ${categoria.idadeMaxima} anos`
    }
  }

  if (categoria.genero !== 'LIVRE' && categoria.genero !== pf.genero) {
    return 'Não corresponde ao seu gênero cadastrado'
  }

  if (categoria.pcd && !pf.pcd) {
    return 'Categoria exclusiva PCD'
  }

  return null
}

function selecionarCategoria(categoria: { id: string; idadeMinima: number | null; idadeMaxima: number | null; genero: string; pcd: boolean }) {
  if (motivoInelegibilidade(categoria)) return
  categoriaSelecionadaId.value = categoria.id
}

const modalidadesAtivas = computed(
  () => eventoSelecionado.value?.modalidades.filter((m) => m.ativo) || []
)

const loteAtivo = computed(() => {
  const agora = new Date()
  return (
    eventoSelecionado.value?.lotes.find(
      (l) =>
        new Date(l.inicioVenda) <= agora &&
        agora <= new Date(l.fimVenda) &&
        (l.vagasRestantes === null || l.vagasRestantes > 0)
    ) || null
  )
})

const modalidadeSelecionada = computed(
  () => modalidadesAtivas.value.find((m) => m.id === modalidadeSelecionadaId.value) || null
)

const categoriaSelecionada = computed(
  () => modalidadeSelecionada.value?.categorias.find((c) => c.id === categoriaSelecionadaId.value) || null
)

const diasRestantesLote = computed(() => {
  if (!loteAtivo.value) return null
  const ms = new Date(loteAtivo.value.fimVenda).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
})

const vagasBadgeClasse = computed(() => {
  const lote = loteAtivo.value
  if (!lote || lote.vagasRestantes === null || !lote.quantidade) return 'text-slate-500'
  return lote.vagasRestantes / lote.quantidade < 0.2 ? 'font-semibold text-red-600' : 'text-slate-500'
})

const podeAvancar = computed(() => {
  if (step.value === 1) return !!modalidadeSelecionadaId.value && !!loteAtivo.value
  if (step.value === 2) return !!categoriaSelecionadaId.value
  return true
})

function precoPara(modalidadeId: string) {
  const preco = loteAtivo.value?.precos.find((p) => p.modalidadeId === modalidadeId)
  return preco ? Number(preco.valor) : null
}

function formatarPreco(valor: number | null) {
  return valor === null ? 'Sem preço definido' : `R$ ${valor.toFixed(2)}`
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const generoLabel: Record<string, string> = {
  MASCULINO: 'Masculino',
  FEMININO: 'Feminino',
  LIVRE: 'Livre'
}

function selecionarModalidade(id: string) {
  modalidadeSelecionadaId.value = id
  categoriaSelecionadaId.value = null
  erroInscricao.value = ''
}

function avancar() {
  if (podeAvancar.value && step.value < passos.length) step.value += 1
}

function voltar() {
  erroInscricao.value = ''
  if (step.value > 1) step.value -= 1
}

async function onInscrever() {
  erroInscricao.value = ''

  if (!token.value) {
    await navigateTo(`/login?redirect=/eventos/${eventoId}`)
    return
  }

  if (!categoriaSelecionadaId.value || !loteAtivo.value) {
    erroInscricao.value = 'Selecione a modalidade e a categoria.'
    return
  }

  inscrevendo.value = true
  try {
    const res = await criar({
      categoriaId: categoriaSelecionadaId.value,
      loteId: loteAtivo.value.id,
      tamanhoCamisa: tamanhoCamisa.value || undefined,
      cupomCodigo: cupomCodigo.value || undefined
    })
    inscricaoCriada.value = { valor: res.valor }
  } catch (e) {
    const msg = extrairErro(e)
    if (msg.includes('Complete seu perfil')) {
      await navigateTo(`/cadastro?redirect=/eventos/${eventoId}`)
      return
    }
    erroInscricao.value = msg
  } finally {
    inscrevendo.value = false
  }
}
</script>

<template>
  <div>
    <p v-if="carregando" class="mx-auto max-w-3xl px-4 py-16 text-sm text-slate-500">Carregando...</p>

    <p
      v-else-if="erro"
      class="mx-auto mt-8 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {{ erro }}
    </p>

    <template v-else-if="eventoSelecionado">
      <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-14 text-white">
        <div class="mx-auto max-w-5xl px-4">
          <h1 class="text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">{{ eventoSelecionado.nome }}</h1>
          <p class="mt-2 text-slate-200">
            📍 {{ eventoSelecionado.local }}, {{ eventoSelecionado.cidade }}/{{ eventoSelecionado.estado }}
          </p>
          <p class="mt-1 text-slate-200">📅 {{ formatarData(eventoSelecionado.dataInicio) }}</p>
        </div>
      </section>

      <div class="mx-auto max-w-5xl px-4 py-10">
        <p v-if="eventoSelecionado.descricao" class="text-slate-700">{{ eventoSelecionado.descricao }}</p>

        <div v-if="inscricaoCriada" class="mt-8 rounded-2xl border border-accent bg-accent/5 p-6">
          <h2 class="text-lg font-extrabold uppercase tracking-tight text-primary">Inscrição criada!</h2>
          <p class="mt-2 text-sm text-slate-700">
            Valor: <strong>R$ {{ Number(inscricaoCriada.valor).toFixed(2) }}</strong>
          </p>
          <p class="mt-2 text-sm text-slate-500">
            Sua inscrição está com pagamento pendente. Em breve você poderá pagar por PIX, cartão ou boleto
            (integração de pagamento em andamento).
          </p>
          <NuxtLink
            to="/minhas-inscricoes"
            class="mt-4 inline-block rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95"
          >
            Ver minhas inscrições
          </NuxtLink>
        </div>

        <template v-else>
          <div class="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            <div class="min-w-0 md:col-span-2">
              <!-- Indicador de passos -->
              <div class="mb-8 flex items-center gap-2">
                <template v-for="(label, i) in passos" :key="label">
                  <div
                    class="flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide"
                    :class="step >= i + 1 ? 'text-primary' : 'text-slate-400'"
                  >
                    <span
                      class="flex h-6 w-6 items-center justify-center rounded-full"
                      :class="step >= i + 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'"
                    >
                      {{ i + 1 }}
                    </span>
                    <span class="hidden sm:inline">{{ label }}</span>
                  </div>
                  <div v-if="i < passos.length - 1" class="h-0.5 flex-1" :class="step >= i + 2 ? 'bg-primary' : 'bg-slate-200'"></div>
                </template>
              </div>

              <!-- Passo 1: Modalidade -->
              <section v-if="step === 1">
                <h2 class="text-xl font-extrabold uppercase tracking-tight text-primary">Escolha sua modalidade</h2>

                <p
                  v-if="!loteAtivo"
                  class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700"
                >
                  As inscrições não estão abertas no momento.
                </p>
                <p v-else class="mt-1 text-xs" :class="vagasBadgeClasse">
                  <template v-if="loteAtivo.vagasRestantes !== null">🎟️ {{ loteAtivo.vagasRestantes }} vagas restantes · </template>
                  Lote atual encerra em {{ diasRestantesLote }} {{ diasRestantesLote === 1 ? 'dia' : 'dias' }}
                </p>

                <div v-if="modalidadesAtivas.length === 0" class="mt-4 text-sm text-slate-500">
                  Nenhuma modalidade disponível para este evento.
                </div>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    v-for="modalidade in modalidadesAtivas"
                    :key="modalidade.id"
                    type="button"
                    class="rounded-2xl border p-4 text-left transition"
                    :class="
                      modalidadeSelecionadaId === modalidade.id
                        ? 'border-accent bg-accent/5'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    "
                    @click="selecionarModalidade(modalidade.id)"
                  >
                    <p class="font-bold text-slate-800">{{ modalidade.nome }} · {{ Number(modalidade.distanciaKm) }}km</p>
                    <p v-if="modalidade.descricao" class="mt-1 text-sm text-slate-500">{{ modalidade.descricao }}</p>
                    <p class="mt-2 text-sm font-semibold text-accent">{{ formatarPreco(precoPara(modalidade.id)) }}</p>
                  </button>
                </div>
              </section>

              <!-- Passo 2: Categoria -->
              <section v-else-if="step === 2 && modalidadeSelecionada">
                <h2 class="text-xl font-extrabold uppercase tracking-tight text-primary">Escolha sua categoria</h2>
                <div class="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    v-for="categoria in modalidadeSelecionada.categorias"
                    :key="categoria.id"
                    type="button"
                    class="rounded-xl border px-4 py-3 text-left text-sm transition"
                    :disabled="!!motivoInelegibilidade(categoria)"
                    :class="
                      motivoInelegibilidade(categoria)
                        ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                        : categoriaSelecionadaId === categoria.id
                          ? 'border-accent bg-accent/5 text-primary'
                          : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    "
                    @click="selecionarCategoria(categoria)"
                  >
                    <span class="font-semibold">{{ categoria.nome }}</span>
                    <span class="ml-1 text-slate-400">
                      ({{ generoLabel[categoria.genero] }}<template v-if="categoria.idadeMinima || categoria.idadeMaxima">
                        , {{ categoria.idadeMinima || '0' }}-{{ categoria.idadeMaxima || '+' }} anos</template
                      ><template v-if="categoria.pcd">, PCD</template>)
                    </span>
                    <p v-if="motivoInelegibilidade(categoria)" class="mt-1 text-xs text-red-500">
                      Você não se encaixa: {{ motivoInelegibilidade(categoria) }}
                    </p>
                  </button>
                </div>
              </section>

              <!-- Passo 3: Complementos -->
              <section v-else-if="step === 3">
                <h2 class="text-xl font-extrabold uppercase tracking-tight text-primary">Tamanho da camisa</h2>
                <p class="mt-1 text-sm text-slate-500">Opcional — pode escolher depois se ainda não souber.</p>
                <div class="mt-4 flex gap-2">
                  <button
                    v-for="tam in tamanhos"
                    :key="tam"
                    type="button"
                    class="rounded-xl border px-4 py-2 text-sm font-bold transition"
                    :class="
                      tamanhoCamisa === tam
                        ? 'border-accent bg-accent/5 text-primary'
                        : 'border-slate-300 text-slate-600 hover:border-slate-400'
                    "
                    @click="tamanhoCamisa = tamanhoCamisa === tam ? '' : tam"
                  >
                    {{ tam }}
                  </button>
                </div>
              </section>

              <!-- Passo 4: Revisão -->
              <section v-else-if="step === 4">
                <h2 class="text-xl font-extrabold uppercase tracking-tight text-primary">Revise e confirme</h2>
                <p class="mt-1 text-sm text-slate-500">Confira os detalhes no resumo ao lado antes de confirmar.</p>

                <div class="mt-6">
                  <label class="mb-1 block text-sm font-semibold text-slate-700">Cupom de desconto (opcional)</label>
                  <input
                    v-model="cupomCodigo"
                    type="text"
                    placeholder="Código do cupom"
                    class="w-full max-w-xs rounded-xl border border-slate-300 px-4 py-3 text-sm uppercase focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                </div>

                <label class="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                  <input v-model="aceiteTermos" type="checkbox" class="mt-1 h-4 w-4 accent-accent" />
                  <span class="text-sm text-slate-700">
                    Li e aceito
                    <a
                      v-if="eventoSelecionado.regulamentoUrl"
                      :href="eventoSelecionado.regulamentoUrl"
                      target="_blank"
                      rel="noopener"
                      class="font-semibold text-secondary underline"
                    >
                      o regulamento
                    </a>
                    <template v-else>os termos de inscrição</template>
                    deste evento.
                  </span>
                </label>

                <p v-if="erroInscricao" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {{ erroInscricao }}
                </p>
              </section>

              <!-- Navegação -->
              <div class="mt-8 flex gap-3">
                <button
                  v-if="step > 1"
                  type="button"
                  class="rounded-xl border border-slate-300 px-6 py-3 text-sm font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-100"
                  @click="voltar"
                >
                  Voltar
                </button>
                <button
                  v-if="step < passos.length"
                  type="button"
                  :disabled="!podeAvancar"
                  class="flex-1 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow transition hover:brightness-95 disabled:opacity-50"
                  @click="avancar"
                >
                  Continuar
                </button>
                <button
                  v-else
                  type="button"
                  :disabled="inscrevendo || !aceiteTermos"
                  class="flex-1 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95 disabled:opacity-50"
                  @click="onInscrever"
                >
                  {{ inscrevendo ? 'Confirmando...' : 'Confirmar inscrição' }}
                </button>
              </div>
            </div>

            <!-- Resumo -->
            <aside class="order-first min-w-0 md:order-last">
              <div class="sticky top-20 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 class="text-xs font-bold uppercase tracking-wide text-slate-400">Resumo da inscrição</h3>
                <p class="mt-3 font-bold text-slate-800">{{ eventoSelecionado.nome }}</p>

                <dl class="mt-4 flex flex-col gap-3 text-sm">
                  <div v-if="modalidadeSelecionada" class="flex items-center justify-between">
                    <dt class="text-slate-500">Modalidade</dt>
                    <dd class="font-medium text-slate-800">{{ modalidadeSelecionada.nome }}</dd>
                  </div>
                  <div v-if="categoriaSelecionada" class="flex items-center justify-between">
                    <dt class="text-slate-500">Categoria</dt>
                    <dd class="font-medium text-slate-800">{{ categoriaSelecionada.nome }}</dd>
                  </div>
                  <div v-if="tamanhoCamisa" class="flex items-center justify-between">
                    <dt class="text-slate-500">Camisa</dt>
                    <dd class="font-medium text-slate-800">{{ tamanhoCamisa }}</dd>
                  </div>
                  <p v-if="!modalidadeSelecionada" class="text-slate-400">Escolha uma modalidade pra ver o resumo.</p>
                </dl>

                <div
                  v-if="modalidadeSelecionada"
                  class="mt-4 flex items-center justify-between border-t border-slate-100 pt-4"
                >
                  <span class="text-sm font-bold uppercase text-slate-500">Total</span>
                  <span class="text-lg font-extrabold text-accent">{{ formatarPreco(precoPara(modalidadeSelecionada.id)) }}</span>
                </div>

                <p v-if="diasRestantesLote !== null" class="mt-4 text-xs" :class="vagasBadgeClasse">
                  <template v-if="loteAtivo?.vagasRestantes !== null">🎟️ {{ loteAtivo?.vagasRestantes }} vagas restantes · </template>
                  Lote encerra em {{ diasRestantesLote }} {{ diasRestantesLote === 1 ? 'dia' : 'dias' }}
                </p>
              </div>
            </aside>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
