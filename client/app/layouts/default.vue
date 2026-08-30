<template>
  <div class="flex min-h-screen flex-col bg-slate-50 overflow-x-hidden w-full max-w-full">
    <AppHeader />
    <AvisoEmailNaoVerificado />
    <main class="flex-1 w-full max-w-full overflow-x-hidden">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

