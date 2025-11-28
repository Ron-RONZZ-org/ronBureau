<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card card">
        <div class="login-header">
          <div class="brand">
            <span class="brand-icon">📊</span>
            <h1>RonBureau</h1>
          </div>
          <p class="subtitle">Sign in to your account</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="input-group">
            <label for="userId">User ID</label>
            <input 
              id="userId" 
              v-model="form.userId" 
              type="text" 
              class="input" 
              placeholder="Enter your user ID"
              required
              autocomplete="username"
            />
          </div>

          <div class="input-group">
            <label for="password">Password</label>
            <input 
              id="password" 
              v-model="form.password" 
              type="password" 
              class="input" 
              placeholder="Enter your password"
              required
              autocomplete="current-password"
            />
          </div>

          <p v-if="error" class="error-text">{{ error }}</p>

          <button type="submit" class="btn btn-primary w-full" :disabled="loading">
            {{ loading ? 'Signing in...' : 'Sign In' }}
          </button>
        </form>

        <div class="login-footer">
          <p class="text-muted text-center">
            Test credentials: <code>admin</code> / <code>password123</code>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

definePageMeta({
  layout: 'default',
});

const auth = useAuthStore();

const form = reactive({
  userId: '',
  password: '',
});

const loading = ref(false);
const error = ref('');

// Initialize from storage and redirect if already authenticated
onMounted(() => {
  auth.initFromStorage();
  if (auth.isAuthenticated) {
    navigateTo('/home');
  }
});

const handleLogin = async () => {
  error.value = '';
  loading.value = true;

  const result = await auth.login(form.userId, form.password);

  if (result.success) {
    navigateTo('/home');
  } else {
    error.value = result.error || 'Login failed';
  }

  loading.value = false;
};
</script>

<style scoped>
.login-page {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.login-container {
  width: 100%;
  max-width: 400px;
}

.login-card {
  padding: 2.5rem;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.brand-icon {
  font-size: 2rem;
}

.brand h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
}

.subtitle {
  color: var(--color-text-muted);
}

.login-form {
  margin-bottom: 1.5rem;
}

.login-footer {
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.login-footer code {
  background-color: var(--color-background);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.error-text {
  margin-bottom: 1rem;
}
</style>
