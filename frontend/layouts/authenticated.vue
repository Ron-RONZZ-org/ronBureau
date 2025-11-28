<template>
  <div class="app-layout">
    <AppNavbar />
    <main class="main-content">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const auth = useAuthStore();

// Redirect to login if not authenticated
onMounted(() => {
  if (!auth.isAuthenticated) {
    navigateTo('/');
  }
});

// Watch for logout
watch(() => auth.isAuthenticated, (isAuth) => {
  if (!isAuth) {
    navigateTo('/');
  }
});
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding: 2rem 0;
}
</style>
