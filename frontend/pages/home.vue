<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="container">
        <div class="home-page">
          <div class="welcome-section card">
            <h1 class="welcome-title">Welcome, {{ auth.user?.displayName }}!</h1>
          </div>
          <div class="datetime-section card">
            <h2 class="section-title">📅 Current Date & Time</h2>
            <div class="datetime-display">
              <div class="datetime-main">{{ formattedDatetime }}</div>
              <div class="datetime-timezone">{{ timezone }}</div>
            </div>
            <div class="datetime-formats">
              <div class="format-item">
                <span class="format-label">Your preferred format:</span>
                <span class="format-value">{{ preferredFormat }}</span>
              </div>
            </div>
          </div>

          <!-- Last Accessed Tools Section -->
          <div class="last-accessed-section card" v-if="lastAccessedTools.length > 0">
            <h2 class="section-title">🕐 Last Accessed Tools</h2>
            <div class="tools-grid">
              <NuxtLink
                v-for="tool in lastAccessedTools"
                :key="tool.id"
                :to="tool.path"
                class="tool-card"
              >
                <span class="tool-icon">{{ tool.icon }}</span>
                <span class="tool-name">{{ tool.name }}</span>
                <span class="tool-time">{{ formatAccessTime(tool.accessedAt) }}</span>
              </NuxtLink>
            </div>
          </div>

        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';
import { useDatetime } from '~/composables/useDatetime';

interface LastAccessedTool {
  id: string;
  name: string;
  icon: string;
  path: string;
  accessedAt: string;
}

const auth = useAuthStore();
const { formatDatetime } = useDatetime();

// Ensure auth is initialized
onMounted(() => {
  auth.initFromStorage();
});

const currentTime = ref(new Date());
const lastAccessedTools = ref<LastAccessedTool[]>([]);

// Update time every second
let timer: NodeJS.Timeout;
onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);

  // Load last accessed tools
  loadLastAccessedTools();
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function loadLastAccessedTools() {
  if (import.meta.client) {
    const saved = localStorage.getItem('lastAccessedTools');
    if (saved) {
      try {
        lastAccessedTools.value = JSON.parse(saved);
      } catch {
        lastAccessedTools.value = [];
      }
    }
  }
}

function formatAccessTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const userTypeName = computed(() => {
  switch (auth.user?.userType) {
    case 'ADMINISTRATOR': return 'Administrator';
    case 'ORGANIZATION_OWNER': return 'Organization Owner';
    default: return 'User';
  }
});

const formattedDatetime = computed(() => {
  const format = auth.userPreferences.datetimeFormat || 'ISO';
  return formatDatetime(currentTime.value, format);
});

const preferredFormat = computed(() => {
  return auth.userPreferences.datetimeFormat || 'ISO';
});

const timezone = computed(() => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
});
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.welcome-section {
  text-align: center;
  padding: 2.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.welcome-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.welcome-subtitle {
  opacity: 0.9;
  font-size: 1.125rem;
}

.datetime-section {
  text-align: center;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--color-text);
}

.datetime-display {
  margin-bottom: 1.5rem;
}

.datetime-main {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-primary);
  font-family: 'Monaco', 'Consolas', monospace;
}

.datetime-timezone {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

.datetime-formats {
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.format-item {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
}

.format-label {
  color: var(--color-text-muted);
}

.format-value {
  font-weight: 500;
  color: var(--color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
}

@media (min-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.info-card {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.info-icon {
  font-size: 2rem;
}

.info-content h3 {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
}

.info-content p {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

/* Last Accessed Tools Section */
.last-accessed-section {
  margin-top: 0.5rem;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 0.75rem;
}

@media (min-width: 640px) {
  .tools-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .tools-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-background);
  border-radius: var(--radius);
  text-decoration: none;
  color: inherit;
  transition: var(--transition);
}

.tool-card:hover {
  background: rgba(59, 130, 246, 0.1);
  transform: translateY(-1px);
}

.tool-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.tool-name {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
  color: var(--color-text);
}

.tool-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
