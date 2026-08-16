<template>
  <div class="flex min-h-screen flex-col bg-slate-50">
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>
