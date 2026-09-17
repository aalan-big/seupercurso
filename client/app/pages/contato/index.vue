<script setup lang="ts">
import { Mail, MapPin, Clock, CheckCircle2, ArrowRight, Send, ArrowUpRight } from 'lucide-vue-next'

const { enviarContato } = useContato()
const config = useRuntimeConfig()

// Suporte via WhatsApp. Guardamos só os dígitos (DDI+DDD+número) e
// montamos o link wa.me com uma mensagem inicial pra facilitar o primeiro contato.
const WHATSAPP_NUMERO = '5588992369086'
const WHATSAPP_EXIBICAO = '(88) 99236-9086'
const whatsappUrl = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent('Olá! Vim pelo site SeuPercurso e preciso de ajuda.')}`

const EMAIL = 'contato@seupercurso.com.br'

const organizerCadastroLink = computed(() => {
  let base = config.public.organizerBase as string
  if (import.meta.client && window.location.hostname && base.includes('localhost')) {
    base = base.replace('localhost', window.location.hostname)
  }
  return `${base}/cadastro`
})

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
      <div class="pointer-events-none absolute -right-20 -top-20 hidden h-72 w-72 rotate-12 rounded-[3rem] bg-warning/20 sm:block"></div>
      <div class="pointer-events-none absolute -bottom-24 -left-16 hidden h-64 w-64 rotate-12 rounded-[3rem] bg-warning/10 sm:block"></div>
      <div class="relative mx-auto max-w-4xl px-4 text-center">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-warning backdrop-blur">
          <Mail :size="14" /> Fale conosco
        </span>
        <h1 class="mt-5 text-3xl font-extrabold uppercase leading-tight tracking-tight sm:text-5xl">Estamos por aqui</h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
          Dúvidas sobre inscrições, eventos ou parcerias? Chama no WhatsApp ou manda sua mensagem que a gente responde.
        </p>
        <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            :href="whatsappUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95 sm:w-auto"
          >
            <img src="/icone_whats.webp" alt="" class="h-6 w-6" /> Chamar no WhatsApp
          </a>
          <a
            href="#formulario"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white hover:text-primary sm:w-auto"
          >
            Enviar mensagem <ArrowRight :size="16" />
          </a>
        </div>
      </div>
    </section>

    <section class="bg-slate-50 py-16 sm:py-20">
      <div class="mx-auto max-w-6xl px-4">
        <div class="grid gap-8 lg:grid-cols-5 lg:gap-10">
          <div id="formulario" class="scroll-mt-24 lg:col-span-3">
            <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <span class="text-xs font-bold uppercase tracking-widest text-warning">Formulário</span>
              <h2 class="mt-2 text-2xl font-extrabold uppercase tracking-tight text-primary">Envie uma mensagem</h2>
              <p class="mt-2 text-sm text-slate-500">Conta o que precisa e a gente responde no e-mail informado.</p>

              <p v-if="erro" class="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {{ erro }}
              </p>

              <div v-if="enviado" class="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-6 py-12 text-center">
                <span class="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-white">
                  <CheckCircle2 :size="32" />
                </span>
                <p class="mt-2 text-lg font-extrabold uppercase tracking-tight text-primary">Mensagem enviada!</p>
                <p class="max-w-sm text-sm text-slate-600">
                  Recebemos sua mensagem e vamos te responder por e-mail em breve.
                </p>
                <button
                  type="button"
                  class="mt-3 text-sm font-semibold text-secondary hover:underline"
                  @click="enviado = false"
                >
                  Enviar outra mensagem
                </button>
              </div>

              <form v-else class="mt-6 flex flex-col gap-5" @submit.prevent="onSubmit">
                <div class="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label for="contato-nome" class="mb-1.5 block text-sm font-semibold text-slate-700">Nome</label>
                    <input
                      id="contato-nome"
                      v-model="form.nome"
                      type="text"
                      required
                      autocomplete="name"
                      placeholder="Seu nome"
                      class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-warning focus:bg-white focus:outline-none focus:ring-2 focus:ring-warning/30"
                    />
                  </div>
                  <div>
                    <label for="contato-email" class="mb-1.5 block text-sm font-semibold text-slate-700">E-mail</label>
                    <input
                      id="contato-email"
                      v-model="form.email"
                      type="email"
                      required
                      autocomplete="email"
                      placeholder="voce@email.com"
                      class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-warning focus:bg-white focus:outline-none focus:ring-2 focus:ring-warning/30"
                    />
                  </div>
                </div>
                <div>
                  <label for="contato-assunto" class="mb-1.5 block text-sm font-semibold text-slate-700">
                    Assunto <span class="font-normal text-slate-400">(opcional)</span>
                  </label>
                  <input
                    id="contato-assunto"
                    v-model="form.assunto"
                    type="text"
                    placeholder="Ex: Dúvida sobre inscrição, parceria..."
                    class="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-warning focus:bg-white focus:outline-none focus:ring-2 focus:ring-warning/30"
                  />
                </div>
                <div>
                  <label for="contato-mensagem" class="mb-1.5 block text-sm font-semibold text-slate-700">Mensagem</label>
                  <textarea
                    id="contato-mensagem"
                    v-model="form.mensagem"
                    required
                    rows="6"
                    minlength="5"
                    placeholder="Escreva sua mensagem aqui..."
                    class="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-warning focus:bg-white focus:outline-none focus:ring-2 focus:ring-warning/30"
                  ></textarea>
                </div>
                <div class="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p class="text-xs text-slate-400">Seus dados são usados só pra responder esta mensagem.</p>
                  <button
                    type="submit"
                    :disabled="enviando"
                    class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95 disabled:opacity-50 sm:w-auto"
                  >
                    <Send :size="16" /> {{ enviando ? 'Enviando...' : 'Enviar mensagem' }}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <aside class="flex flex-col gap-6 lg:col-span-2">
            <a
              :href="whatsappUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-secondary p-6 text-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl sm:p-8"
            >
              <div class="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rotate-12 rounded-[2rem] bg-accent/20 transition group-hover:scale-110"></div>
              <div class="relative">
                <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent">
                  <span class="h-1.5 w-1.5 rounded-full bg-accent"></span> Canal mais rápido
                </span>
                <img src="/icone_whats.webp" alt="WhatsApp" class="mt-5 h-16 w-16 rounded-2xl bg-white shadow-lg shadow-accent/30" />
                <h3 class="mt-5 text-lg font-extrabold uppercase tracking-tight">WhatsApp do suporte</h3>
                <p class="mt-1 text-2xl font-extrabold tracking-tight text-white">{{ WHATSAPP_EXIBICAO }}</p>
                <p class="mt-2 text-sm text-slate-300">Atendimento em horário comercial. Toque pra abrir a conversa.</p>
                <span class="mt-5 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-accent">
                  Abrir conversa <ArrowUpRight :size="16" class="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </div>
            </a>

            <div class="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div class="border-b border-slate-100 px-6 py-4">
                <span class="text-xs font-bold uppercase tracking-widest text-warning">Outros canais</span>
              </div>
              <div class="divide-y divide-slate-100">
                <a :href="`mailto:${EMAIL}`" class="group flex items-start gap-4 px-6 py-5 transition hover:bg-slate-50">
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <Mail :size="20" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold text-slate-800">E-mail</p>
                    <p class="mt-0.5 truncate text-sm font-semibold text-secondary group-hover:underline">{{ EMAIL }}</p>
                  </div>
                </a>

                <a
                  :href="organizerCadastroLink"
                  target="_blank"
                  class="group flex items-start gap-4 px-6 py-5 transition hover:bg-slate-50"
                >
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <MapPin :size="20" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold text-slate-800">Organiza eventos?</p>
                    <p class="mt-0.5 text-sm text-slate-500">Cadastre seu evento na plataforma e gerencie tudo num só lugar.</p>
                    <span class="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-secondary group-hover:underline">
                      Criar meu evento <ArrowUpRight :size="14" />
                    </span>
                  </div>
                </a>

                <div class="flex items-start gap-4 px-6 py-5">
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                    <Clock :size="20" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-bold text-slate-800">Tempo de resposta</p>
                    <p class="mt-0.5 text-sm text-slate-500">
                      No WhatsApp costumamos responder na hora, em horário comercial. Por e-mail, assim que possível.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  </div>
</template>
