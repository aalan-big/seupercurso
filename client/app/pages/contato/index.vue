<script setup lang="ts">
import { Mail, MapPin, Clock, CheckCircle2 } from 'lucide-vue-next'

const { enviarContato } = useContato()

const form = reactive({ nome: '', email: '', assunto: '', mensagem: '' })
const erro = ref('')
const enviado = ref(false)
const enviando = ref(false)

async function onSubmit() {
  erro.value = ''
  enviando.value = true
  try {
    await enviarContato({ ...form })
    enviado.value = true
    form.nome = ''
    form.email = ''
    form.assunto = ''
    form.mensagem = ''
  } catch (e) {
    erro.value = extrairErro(e)
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-16 text-white sm:py-24">
      <div class="pointer-events-none absolute -right-20 -top-20 hidden h-72 w-72 rotate-12 rounded-[3rem] bg-accent/20 sm:block"></div>
      <div class="relative mx-auto max-w-4xl px-4 text-center">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-warning backdrop-blur">
          <Mail :size="14" /> Fale conosco
        </span>
        <h1 class="mt-5 text-3xl font-extrabold uppercase leading-tight tracking-tight sm:text-5xl">Estamos por aqui</h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
          Dúvidas sobre inscrições, eventos ou parcerias? Manda sua mensagem que a gente responde.
        </p>
      </div>
    </section>

    <section class="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <div class="grid gap-10 lg:grid-cols-5 lg:gap-12">
        <div class="lg:col-span-3">
          <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 class="text-lg font-extrabold uppercase tracking-tight text-primary">Envie uma mensagem</h2>
            <p class="mt-1 text-sm text-slate-500">Respondemos o mais rápido possível pelo e-mail informado.</p>

            <p v-if="erro" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {{ erro }}
            </p>

            <div v-if="enviado" class="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-6 py-10 text-center">
              <CheckCircle2 :size="40" class="text-accent" />
              <p class="font-bold text-primary">Mensagem enviada!</p>
              <p class="max-w-sm text-sm text-slate-600">
                Recebemos sua mensagem e vamos te responder por e-mail em breve.
              </p>
              <button
                type="button"
                class="mt-2 text-sm font-semibold text-secondary hover:underline"
                @click="enviado = false"
              >
                Enviar outra mensagem
              </button>
            </div>

            <form v-else class="mt-6 flex flex-col gap-4" @submit.prevent="onSubmit">
              <div class="grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="mb-1 block text-sm font-semibold text-slate-700">Nome</label>
                  <input
                    v-model="form.nome"
                    type="text"
                    required
                    class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                  />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-semibold text-slate-700">E-mail</label>
                  <input
                    v-model="form.email"
                    type="email"
                    required
                    class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                  />
                </div>
              </div>
              <div>
                <label class="mb-1 block text-sm font-semibold text-slate-700">Assunto (opcional)</label>
                <input
                  v-model="form.assunto"
                  type="text"
                  placeholder="Ex: Dúvida sobre inscrição, parceria..."
                  class="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-semibold text-slate-700">Mensagem</label>
                <textarea
                  v-model="form.mensagem"
                  required
                  rows="5"
                  minlength="5"
                  class="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-warning focus:outline-none focus:ring-2 focus:ring-warning/30"
                ></textarea>
              </div>
              <button
                type="submit"
                :disabled="enviando"
                class="mt-2 rounded-xl bg-warning px-4 py-3 text-sm font-bold uppercase tracking-wide text-primary transition hover:brightness-95 disabled:opacity-50"
              >
                {{ enviando ? 'Enviando...' : 'Enviar mensagem' }}
              </button>
            </form>
          </div>
        </div>

        <div class="flex flex-col gap-4 lg:col-span-2">
          <a
            href="mailto:contato@seupercurso.com.br"
            class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Mail :size="22" />
            </span>
            <h3 class="mt-4 font-bold text-slate-800">E-mail direto</h3>
            <p class="mt-1 text-sm text-secondary">contato@seupercurso.com.br</p>
          </a>

          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <MapPin :size="22" />
            </span>
            <h3 class="mt-4 font-bold text-slate-800">Organizadores</h3>
            <p class="mt-1 text-sm text-slate-500">
              Quer cadastrar um evento? Conta os detalhes pelo formulário ou pelo e-mail que retornamos em breve.
            </p>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <Clock :size="22" />
            </span>
            <h3 class="mt-4 font-bold text-slate-800">Tempo de resposta</h3>
            <p class="mt-1 text-sm text-slate-500">
              Respondemos por e-mail assim que possível.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
