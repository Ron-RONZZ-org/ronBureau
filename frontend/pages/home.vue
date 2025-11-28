<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="container">
        <div class="home-page">
          <div class="welcome-section card">
            <h1 class="welcome-title">Welcome, {{ auth.user?.displayName }}!</h1>
            <p class="welcome-subtitle">You are logged in as a {{ userTypeName }}</p>
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

          <div class="info-grid">
            <div class="info-card card">
              <div class="info-icon">🏢</div>
              <div class="info-content">
                <h3>Organization</h3>
                <p>{{ auth.user?.organizationId }}</p>
              </div>
            </div>

            <div class="info-card card">
              <div class="info-icon">👤</div>
              <div class="info-content">
                <h3>User ID</h3>
                <p>{{ auth.user?.userId }}</p>
              </div>
            </div>

            <div class="info-card card">
              <div class="info-icon">🎨</div>
              <div class="info-content">
                <h3>Theme</h3>
                <p>{{ auth.userPreferences.theme === 'dark' ? 'Dark Mode' : 'Light Mode' }}</p>
              </div>
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

const auth = useAuthStore();
const { formatDatetime } = useDatetime();

// Ensure auth is initialized
onMounted(() => {
  auth.initFromStorage();
});

const currentTime = ref(new Date());

// Update time every second
let timer: NodeJS.Timeout;
onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

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
</style>
