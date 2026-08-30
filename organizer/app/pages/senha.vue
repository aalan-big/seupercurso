<script setup lang="ts">
const { alterarSenha } = useAuth()

const form = reactive({ senhaAtual: '', novaSenha: '', confirmarSenha: '' })
const erro = ref('')
const sucesso = ref('')
const salvando = ref(false)

async function onSalvar() {
  erro.value = ''
  sucesso.value = ''

  if (form.novaSenha.length < 8) {
    erro.value = 'A nova senha precisa ter pelo menos 8 caracteres.'
    return
  }
  if (form.novaSenha !== form.confirmarSenha) {
    erro.value = 'A confirmação não bate com a nova senha.'
    return
  }

  salvando.value = true
  try {
    await alterarSenha(form.senhaAtual, form.novaSenha)
    sucesso.value = 'Senha alterada.'
    form.senhaAtual = ''
    form.novaSenha = ''
    form.confirmarSenha = ''
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-extrabold uppercase tracking-tight text-primary">Alterar senha</h1>
    <p class="mt-1 text-sm text-slate-500">Troque a senha de acesso à sua conta.</p>

    <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ erro }}</p>
    <p v-if="sucesso" class="mt-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">{{ sucesso }}</p>

    <form class="mt-6 flex max-w-sm flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="onSalvar">
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Senha atual</label>
        <input
          v-model="form.senhaAtual"
          type="password"
          required
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Nova senha</label>
        <input
          v-model="form.novaSenha"
          type="password"
          required
          minlength="8"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        />
      </div>
      <div>
        <label class="mb-1 block text-sm font-semibold text-slate-700">Confirmar nova senha</label>
        <input
          v-model="form.confirmarSenha"
          type="password"
          required
          minlength="8"
          class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
        />
      </div>
      <button
        type="submit"
        :disabled="salvando"
        class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
      >
        {{ salvando ? 'Salvando...' : 'Salvar' }}
      </button>
    </form>
  </div>
</template>
