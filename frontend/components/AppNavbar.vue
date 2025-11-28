<template>
  <nav class="navbar">
    <div class="navbar-container">
      <NuxtLink to="/home" class="navbar-brand">
        <span class="brand-icon">📊</span>
        RonBureau
      </NuxtLink>

      <div class="navbar-menu" v-if="auth.isAuthenticated">
        <NuxtLink to="/home" class="nav-link" :class="{ active: route.path === '/home' }">
          Home
        </NuxtLink>
        <NuxtLink to="/dashboard" class="nav-link" :class="{ active: route.path === '/dashboard' }">
          Dashboard
        </NuxtLink>
      </div>

      <div class="navbar-actions" v-if="auth.isAuthenticated">
        <span class="user-info">
          <span class="user-name">{{ auth.user?.displayName }}</span>
          <span class="user-badge" :class="badgeClass">{{ userTypeName }}</span>
        </span>
        <button class="btn btn-outline" @click="handleLogout">Logout</button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const auth = useAuthStore();
const route = useRoute();

const userTypeName = computed(() => {
  switch (auth.user?.userType) {
    case 'ADMINISTRATOR': return 'Admin';
    case 'ORGANIZATION_OWNER': return 'Owner';
    default: return 'User';
  }
});

const badgeClass = computed(() => {
  switch (auth.user?.userType) {
    case 'ADMINISTRATOR': return 'badge-warning';
    case 'ORGANIZATION_OWNER': return 'badge-primary';
    default: return 'badge-success';
  }
});

const handleLogout = () => {
  auth.logout();
};
</script>

<style scoped>
.navbar {
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 0.75rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.navbar-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.navbar-brand:hover {
  color: var(--color-primary);
}

.brand-icon {
  font-size: 1.5rem;
}

.navbar-menu {
  display: flex;
  gap: 0.5rem;
}

.nav-link {
  padding: 0.5rem 1rem;
  border-radius: var(--radius);
  color: var(--color-text-muted);
  font-weight: 500;
}

.nav-link:hover, .nav-link.active {
  color: var(--color-primary);
  background-color: rgba(59, 130, 246, 0.1);
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.user-name {
  font-weight: 500;
  color: var(--color-text);
}

.user-badge {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
}

.badge-success {
  background-color: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

.badge-warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.badge-primary {
  background-color: rgba(59, 130, 246, 0.1);
  color: var(--color-primary);
}
</style>
