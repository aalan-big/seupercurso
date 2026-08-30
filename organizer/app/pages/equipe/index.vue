<script setup lang="ts">
const { membros, fetchLista, criar, atualizar, redefinirSenha, remover } = useStaff()

const carregando = ref(true)
const erro = ref('')
const sucesso = ref('')

onMounted(async () => {
  try {
    await fetchLista()
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    carregando.value = false
  }
})

const mostrarForm = ref(false)
const salvando = ref(false)
const novoForm = reactive({ nome: '', email: '', senha: '', funcao: '' })

async function onCriar() {
  erro.value = ''
  sucesso.value = ''
  if (!novoForm.nome || !novoForm.email || novoForm.senha.length < 6) {
    erro.value = 'Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.'
    return
  }
  salvando.value = true
  try {
    await criar({
      nome: novoForm.nome,
      email: novoForm.email,
      senha: novoForm.senha,
      funcao: novoForm.funcao || undefined
    })
    sucesso.value = `Membro criado. Login: ${novoForm.email}`
    novoForm.nome = ''
    novoForm.email = ''
    novoForm.senha = ''
    novoForm.funcao = ''
    mostrarForm.value = false
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}

async function onAlternarAtivo(membro: (typeof membros.value)[number]) {
  erro.value = ''
  try {
    await atualizar(membro.id, { ativo: !membro.ativo })
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

const redefinindoId = ref<string | null>(null)
const novaSenhaTemp = ref('')

function abrirRedefinir(id: string) {
  redefinindoId.value = id
  novaSenhaTemp.value = ''
  sucesso.value = ''
  erro.value = ''
}

async function onRedefinirSenha() {
  if (!redefinindoId.value) return
  erro.value = ''
  if (novaSenhaTemp.value.length < 6) {
    erro.value = 'A senha precisa ter pelo menos 6 caracteres.'
    return
  }
  try {
    await redefinirSenha(redefinindoId.value, novaSenhaTemp.value)
    sucesso.value = 'Senha redefinida.'
    redefinindoId.value = null
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

async function onRemover(id: string) {
  erro.value = ''
  try {
    await remover(id)
  } catch (e) {
    erro.value = extrairErro(e)
  }
}

const linkStaff = computed(() => `${typeof window !== 'undefined' ? window.location.origin : ''}/staff/login`)
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Minha equipe</h1>
    <p class="mt-1 text-sm text-slate-500">
      Cadastre quem vai te ajudar no check-in no dia do evento. Cada membro só tem acesso à busca e confirmação de kit — nada de financeiro ou edição de evento.
    </p>

    <div class="mt-4 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm text-slate-600">
      Passe esse link pra sua equipe acessar pelo celular: <span class="font-semibold text-secondary">{{ linkStaff }}</span>
    </div>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

    <p v-if="carregando" class="mt-6 text-sm text-slate-500">Carregando...</p>

    <template v-else>
      <div v-if="membros.length === 0" class="mt-6 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        Nenhum membro cadastrado ainda.
      </div>

      <div v-else class="mt-6 flex flex-col gap-3">
        <div
          v-for="membro in membros"
          :key="membro.id"
          class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="font-bold text-slate-800">{{ membro.nome }}</p>
              <p class="text-xs text-slate-400">{{ membro.email }}<template v-if="membro.funcao"> · {{ membro.funcao }}</template></p>
            </div>
            <span
              class="shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
              :class="membro.ativo ? 'bg-accent/10 text-accent' : 'bg-slate-200 text-slate-500'"
            >
              {{ membro.ativo ? 'Ativo' : 'Inativo' }}
            </span>
          </div>

          <div class="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button type="button" class="text-xs font-bold uppercase tracking-wide text-secondary hover:underline" @click="onAlternarAtivo(membro)">
              {{ membro.ativo ? 'Desativar' : 'Ativar' }}
            </button>
            <button type="button" class="text-xs font-bold uppercase tracking-wide text-slate-500 hover:underline" @click="abrirRedefinir(membro.id)">
              Redefinir senha
            </button>
            <button type="button" class="text-xs font-bold uppercase tracking-wide text-red-600 hover:text-red-700" @click="onRemover(membro.id)">
              Remover
            </button>
          </div>

          <div v-if="redefinindoId === membro.id" class="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <input
              v-model="novaSenhaTemp"
              type="text"
              placeholder="Nova senha (mín. 6 caracteres)"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
            />
            <button type="button" class="shrink-0 rounded-lg bg-warning px-3 py-2 text-xs font-bold uppercase tracking-wide text-primary hover:brightness-95" @click="onRedefinirSenha">
              Salvar
            </button>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <button
          v-if="!mostrarForm"
          type="button"
          class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
          @click="mostrarForm = true"
        >
          + Novo membro
        </button>

        <form v-else class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" @submit.prevent="onCriar">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input v-model="novoForm.nome" type="text" placeholder="Nome" class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30" />
            <input v-model="novoForm.email" type="email" placeholder="E-mail (login)" class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30" />
            <input v-model="novoForm.senha" type="text" placeholder="Senha (mín. 6 caracteres)" class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30" />
            <input v-model="novoForm.funcao" type="text" placeholder="Função (opcional, ex.: Kits)" class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30" />
          </div>
          <div class="mt-3 flex gap-2">
            <button type="submit" :disabled="salvando" class="rounded-xl bg-warning px-4 py-2 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50">
              {{ salvando ? 'Salvando...' : 'Salvar membro' }}
            </button>
            <button type="button" class="rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100" @click="mostrarForm = false">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </template>
  </div>
</template>
