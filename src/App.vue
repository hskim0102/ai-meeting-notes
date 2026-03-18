<script setup>
import SidebarNav from './components/SidebarNav.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-slate-50">
    <SidebarNav />
    <main class="flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>
