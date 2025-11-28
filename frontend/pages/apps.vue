<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="container">
        <div class="apps-page">
          <div class="page-header">
            <h1>📱 Apps</h1>
            <p class="text-muted">Discover and access available applications</p>
          </div>

          <div class="search-section card">
            <div class="input-group">
              <label for="search">Search Apps</label>
              <input
                id="search"
                v-model="searchQuery"
                type="text"
                class="input"
                placeholder="Search by name or keyword..."
              />
            </div>
          </div>

          <div class="apps-grid">
            <NuxtLink
              v-for="app in filteredApps"
              :key="app.id"
              :to="app.path"
              class="app-card card"
            >
              <div class="app-icon">{{ app.icon }}</div>
              <div class="app-info">
                <h3 class="app-name">{{ app.name }}</h3>
                <p class="app-description">{{ app.description }}</p>
              </div>
            </NuxtLink>
          </div>

          <div v-if="filteredApps.length === 0 && searchQuery.trim() && !isLoading" class="no-results card">
            <p>No apps found matching "{{ searchQuery }}"</p>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

interface AppInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  path: string;
  keywords: string[];
}

const auth = useAuthStore();

onMounted(() => {
  auth.initFromStorage();
});

const searchQuery = ref('');
const apps = ref<AppInfo[]>([]);
const isLoading = ref(true);

// Fetch app info
onMounted(async () => {
  try {
    const response = await fetch('/appInfo.json');
    const data = await response.json();
    apps.value = data.apps;
  } catch (error) {
    console.error('Failed to load app info:', error);
  } finally {
    isLoading.value = false;
  }
});

const filteredApps = computed(() => {
  if (!searchQuery.value.trim()) {
    return apps.value;
  }

  const query = searchQuery.value.toLowerCase();
  return apps.value.filter(app => {
    return (
      app.name.toLowerCase().includes(query) ||
      app.description.toLowerCase().includes(query) ||
      app.keywords.some(keyword => keyword.toLowerCase().includes(query))
    );
  });
});
</script>

<style scoped>
.apps-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header {
  margin-bottom: 1rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.search-section {
  margin-bottom: 1rem;
}

.search-section .input-group {
  margin-bottom: 0;
}

.apps-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
}

@media (min-width: 768px) {
  .apps-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .apps-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.app-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  transition: var(--transition);
  text-decoration: none;
  color: inherit;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.app-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.app-info {
  flex: 1;
  min-width: 0;
}

.app-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--color-text);
}

.app-description {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.no-results {
  text-align: center;
  padding: 2rem;
}

.no-results p {
  color: var(--color-text-muted);
}
</style>
