<script setup lang="ts">
const ano = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-slate-200 bg-white">
    <div class="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500">
      <div class="grid gap-6 sm:grid-cols-3">
        <div>
          <p class="font-semibold text-slate-800">SeuPercurso</p>
          <p class="mt-1">Inscrições para corridas e eventos esportivos.</p>
        </div>
        <div>
          <p class="font-semibold text-slate-800">Atletas</p>
          <ul class="mt-1 flex flex-col gap-1">
            <li><NuxtLink to="/" class="hover:text-secondary">Encontrar eventos</NuxtLink></li>
          </ul>
        </div>
        <div>
          <p class="font-semibold text-slate-800">Organizadores</p>
          <ul class="mt-1 flex flex-col gap-1">
            <li><a href="#" class="hover:text-secondary">Crie seu evento</a></li>
          </ul>
        </div>
      </div>
      <p class="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
        © {{ ano }} SeuPercurso. Todos os direitos reservados.
      </p>
    </div>
  </footer>
</template>
