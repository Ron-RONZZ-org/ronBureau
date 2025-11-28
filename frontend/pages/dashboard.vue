<template>
  <div>
    <NuxtLayout name="authenticated">
      <div class="container">
        <div class="dashboard-page">
          <div class="page-header">
            <h1>User Dashboard</h1>
            <p class="text-muted">Manage your preferences and account settings</p>
          </div>

          <div class="dashboard-grid">
            <!-- User Profile Card -->
            <div class="card profile-card">
              <h2 class="card-title">👤 Profile Information</h2>
              <div class="profile-info">
                <div class="profile-item">
                  <span class="label">Display Name</span>
                  <span class="value">{{ auth.user?.displayName }}</span>
                </div>
                <div class="profile-item">
                  <span class="label">User ID</span>
                  <span class="value">{{ auth.user?.userId }}</span>
                </div>
                <div class="profile-item">
                  <span class="label">Organization</span>
                  <span class="value">{{ auth.user?.organizationId }}</span>
                </div>
                <div class="profile-item">
                  <span class="label">Role</span>
                  <span class="value">
                    <span class="badge" :class="badgeClass">{{ userTypeName }}</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Preferences Card -->
            <div class="card preferences-card">
              <h2 class="card-title">⚙️ User Preferences</h2>
              
              <div class="preference-section">
                <h3>Theme</h3>
                <p class="preference-desc">Choose your preferred appearance</p>
                <div class="theme-options">
                  <button 
                    class="theme-option" 
                    :class="{ active: currentTheme === 'light' }"
                    @click="setTheme('light')"
                  >
                    <span class="theme-icon">☀️</span>
                    <span>Light</span>
                  </button>
                  <button 
                    class="theme-option" 
                    :class="{ active: currentTheme === 'dark' }"
                    @click="setTheme('dark')"
                  >
                    <span class="theme-icon">🌙</span>
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              <div class="preference-section">
                <h3>Date & Time Format</h3>
                <p class="preference-desc">Select how dates and times are displayed</p>
                <select 
                  class="select" 
                  :value="currentDatetimeFormat" 
                  @change="setDatetimeFormat(($event.target as HTMLSelectElement).value)"
                >
                  <option v-for="option in formatOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
                <div class="format-preview mt-4">
                  <span class="label">Preview:</span>
                  <code>{{ formatDatetime(new Date(), currentDatetimeFormat) }}</code>
                </div>
              </div>
            </div>
          </div>

          <div class="status-message" v-if="statusMessage">
            <p :class="statusType">{{ statusMessage }}</p>
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
const { formatDatetime, formatOptions } = useDatetime();

// Ensure auth is initialized
onMounted(() => {
  auth.initFromStorage();
});

const statusMessage = ref('');
const statusType = ref('');

const currentTheme = computed(() => auth.userPreferences.theme || 'light');
const currentDatetimeFormat = computed(() => auth.userPreferences.datetimeFormat || 'ISO');

const userTypeName = computed(() => {
  switch (auth.user?.userType) {
    case 'ADMINISTRATOR': return 'Administrator';
    case 'ORGANIZATION_OWNER': return 'Organization Owner';
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

const showStatus = (message: string, type: 'success' | 'error') => {
  statusMessage.value = message;
  statusType.value = type === 'success' ? 'success-text' : 'error-text';
  setTimeout(() => {
    statusMessage.value = '';
  }, 3000);
};

const setTheme = async (theme: 'light' | 'dark') => {
  const result = await auth.updatePreferences({ theme });
  if (result.success) {
    showStatus('Theme updated successfully!', 'success');
  } else {
    showStatus(result.error || 'Failed to update theme', 'error');
  }
};

const setDatetimeFormat = async (format: string) => {
  const result = await auth.updatePreferences({ datetimeFormat: format });
  if (result.success) {
    showStatus('Date format updated successfully!', 'success');
  } else {
    showStatus(result.error || 'Failed to update date format', 'error');
  }
};
</script>

<style scoped>
.dashboard-page {
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

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profile-item .label {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.profile-item .value {
  font-weight: 500;
}

.preference-section {
  margin-bottom: 2rem;
}

.preference-section:last-child {
  margin-bottom: 0;
}

.preference-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.preference-desc {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.theme-options {
  display: flex;
  gap: 1rem;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  cursor: pointer;
  transition: var(--transition);
}

.theme-option:hover {
  border-color: var(--color-primary);
}

.theme-option.active {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.1);
}

.theme-icon {
  font-size: 1.5rem;
}

.format-preview {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-background);
  border-radius: var(--radius);
}

.format-preview .label {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.format-preview code {
  font-family: 'Monaco', 'Consolas', monospace;
  font-size: 0.875rem;
  color: var(--color-primary);
}

.status-message {
  padding: 1rem;
  border-radius: var(--radius);
  text-align: center;
}

.success-text {
  color: var(--color-success);
  background: rgba(34, 197, 94, 0.1);
  padding: 1rem;
  border-radius: var(--radius);
}
</style>
