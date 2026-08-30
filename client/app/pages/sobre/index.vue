<script setup lang="ts">
import { Target, Zap, Trophy, ShieldCheck, Search, ClipboardCheck, Footprints, ArrowRight } from 'lucide-vue-next'

const config = useRuntimeConfig()

const organizerCadastroLink = computed(() => {
  let base = config.public.organizerBase as string
  if (import.meta.client && window.location.hostname && base.includes('localhost')) {
    base = base.replace('localhost', window.location.hostname)
  }
  return `${base}/cadastro`
})

const passos = [
  {
    icone: Search,
    titulo: 'Encontre seu evento',
    texto: 'Filtre por cidade ou modalidade e descubra corridas, provas de ciclismo e trilhas com informações completas.'
  },
  {
    icone: ClipboardCheck,
    titulo: 'Inscreva-se em poucos passos',
    texto: 'Preencha seus dados uma vez só e garanta sua vaga com pagamento seguro, direto pelo site.'
  },
  {
    icone: Footprints,
    titulo: 'Participe e acompanhe',
    texto: 'Receba seu kit, acompanhe sua inscrição e tenha tudo organizado num só lugar até o dia da prova.'
  }
]

const diferenciais = [
  {
    icone: Target,
    titulo: 'Eventos verificados',
    texto: 'Organizadores reais, informações claras e sem surpresas na hora da inscrição.'
  },
  {
    icone: Zap,
    titulo: 'Inscrição simples',
    texto: 'Poucos passos entre encontrar o evento ideal e garantir sua vaga.'
  },
  {
    icone: ShieldCheck,
    titulo: 'Pagamento seguro',
    texto: 'Checkout protegido e confirmação de inscrição na hora, sem complicação.'
  },
  {
    icone: Trophy,
    titulo: 'Comunidade ativa',
    texto: 'Cada percurso é uma conquista — celebramos cada atleta que cruza a linha.'
  }
]
</script>

<template>
  <div>
    <section class="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary py-16 text-white sm:py-24">
      <div class="pointer-events-none absolute -right-20 -top-20 hidden h-72 w-72 rotate-12 rounded-[3rem] bg-warning/20 sm:block"></div>
      <div class="pointer-events-none absolute -bottom-24 -left-16 hidden h-64 w-64 rotate-12 rounded-[3rem] bg-warning/10 sm:block"></div>
      <div class="relative mx-auto max-w-4xl px-4 text-center">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-warning backdrop-blur">
          <Footprints :size="14" /> Sobre o SeuPercurso
        </span>
        <h1 class="mt-5 text-3xl font-extrabold uppercase leading-tight tracking-tight sm:text-5xl">
          Conectando atletas às<br class="hidden sm:block" /> suas próximas conquistas
        </h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-slate-200">
          Do primeiro 5km à sua próxima maratona: encontre, inscreva-se e participe dos melhores eventos
          esportivos do país, tudo em um só lugar.
        </p>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <span class="text-xs font-bold uppercase tracking-widest text-warning">Nossa missão</span>
          <h2 class="mt-2 text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl">
            Simplificar a jornada do atleta
          </h2>
          <p class="mt-4 text-base leading-relaxed text-slate-600">
            O SeuPercurso nasceu para simplificar a jornada entre encontrar um evento e cruzar a linha de chegada.
            Reunimos corridas, provas de ciclismo, trilhas e outros desafios esportivos em um só lugar, com
            inscrição rápida e organizada para atletas de todos os níveis.
          </p>
          <p class="mt-4 text-base leading-relaxed text-slate-600">
            Também cuidamos da experiência de quem organiza: uma plataforma completa para criar eventos,
            gerenciar inscrições e acompanhar resultados com transparência, do lado do atleta e do organizador.
          </p>
        </div>
        <div class="relative">
          <div class="aspect-[4/3] overflow-hidden rounded-3xl shadow-xl">
            <img src="/hero-corrida.jpg" alt="Atletas em uma prova de corrida" class="h-full w-full object-cover" />
          </div>
          <div class="absolute -bottom-6 -left-6 hidden rounded-2xl bg-white p-4 shadow-xl sm:flex sm:items-center sm:gap-3">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
              <ShieldCheck :size="20" />
            </span>
            <div class="pr-2">
              <p class="text-sm font-bold text-slate-800">Inscrição segura</p>
              <p class="text-xs text-slate-500">Pagamento protegido de ponta a ponta</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="bg-slate-50 py-16 sm:py-20">
      <div class="mx-auto max-w-6xl px-4">
        <div class="mx-auto max-w-2xl text-center">
          <span class="text-xs font-bold uppercase tracking-widest text-warning">Como funciona</span>
          <h2 class="mt-2 text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl">
            Da inscrição à linha de chegada
          </h2>
        </div>

        <div class="mt-12 grid gap-8 sm:grid-cols-3">
          <div v-for="(passo, i) in passos" :key="passo.titulo" class="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span class="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-white">
              {{ i + 1 }}
            </span>
            <component :is="passo.icone" :size="28" class="text-warning" />
            <h3 class="mt-4 font-bold text-slate-800">{{ passo.titulo }}</h3>
            <p class="mt-1 text-sm text-slate-500">{{ passo.texto }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div class="mx-auto max-w-2xl text-center">
        <span class="text-xs font-bold uppercase tracking-widest text-warning">Por que o SeuPercurso</span>
        <h2 class="mt-2 text-2xl font-extrabold uppercase tracking-tight text-primary sm:text-3xl">
          Feito pra quem leva o esporte a sério
        </h2>
      </div>

      <div class="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="item in diferenciais"
          :key="item.titulo"
          class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary">
            <component :is="item.icone" :size="24" />
          </span>
          <h3 class="mt-4 font-bold text-slate-800">{{ item.titulo }}</h3>
          <p class="mt-1 text-sm text-slate-500">{{ item.texto }}</p>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 pb-20">
      <div class="grid gap-6 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-secondary p-8 text-white sm:grid-cols-2 sm:p-12">
        <div>
          <h3 class="text-xl font-extrabold uppercase tracking-tight sm:text-2xl">Você é atleta?</h3>
          <p class="mt-2 text-slate-200">Encontre seu próximo desafio e garanta sua vaga em poucos minutos.</p>
          <NuxtLink
            to="/#eventos"
            class="mt-5 inline-flex items-center gap-2 rounded-xl bg-warning px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary shadow-lg transition hover:brightness-95"
          >
            Ver eventos disponíveis <ArrowRight :size="16" />
          </NuxtLink>
        </div>
        <div class="border-t border-white/15 pt-6 sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0">
          <h3 class="text-xl font-extrabold uppercase tracking-tight sm:text-2xl">Você organiza eventos?</h3>
          <p class="mt-2 text-slate-200">Crie seu evento na plataforma e gerencie inscrições, kits e resultados num só lugar.</p>
          <a
            :href="organizerCadastroLink"
            target="_blank"
            class="mt-5 inline-flex items-center gap-2 rounded-xl border-2 border-white px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-white hover:text-primary"
          >
            Criar meu evento <ArrowRight :size="16" />
          </a>
        </div>
      </div>
    </section>
  </div>
</template>
