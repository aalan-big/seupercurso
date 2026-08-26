<script setup lang="ts">
const { staff, logout } = useStaffAuth()

async function onLogout() {
  logout()
  await navigateTo('/staff/login')
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-slate-50">
    <div class="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <div class="flex items-center gap-2">
        <img src="/logo-header.png" alt="SeuPercurso" class="h-7 w-auto" />
        <span class="text-sm font-bold text-slate-400">Staff</span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span v-if="staff" class="text-slate-500">{{ staff.nome }}</span>
        <button type="button" class="font-bold uppercase tracking-wide text-red-600 hover:text-red-700" @click="onLogout">
          Sair
        </button>
      </div>
    </div>

    <main class="flex-1 p-4">
      <slot />
    </main>
  </div>
</template>
