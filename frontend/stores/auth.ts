import { defineStore } from 'pinia';

interface UserPreferences {
  theme: 'light' | 'dark';
  datetimeFormat: string;
}

interface User {
  id: string;
  userId: string;
  displayName: string;
  userType: 'USER' | 'ADMINISTRATOR' | 'ORGANIZATION_OWNER';
  organizationId: string;
  preferences: UserPreferences | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    isAuthenticated: false,
  }),

  getters: {
    currentUser: (state) => state.user,
    userPreferences: (state): UserPreferences => 
      state.user?.preferences || { theme: 'light', datetimeFormat: 'ISO' },
    isAdmin: (state) => 
      state.user?.userType === 'ADMINISTRATOR' || state.user?.userType === 'ORGANIZATION_OWNER',
  },

  actions: {
    async login(userId: string, password: string) {
      const config = useRuntimeConfig();
      try {
        const response = await $fetch<{ access_token: string; user: User }>(
          `${config.public.apiBase}/auth/login`,
          {
            method: 'POST',
            body: { userId, password },
          }
        );

        this.token = response.access_token;
        this.user = response.user;
        this.isAuthenticated = true;

        // Store token in localStorage
        if (import.meta.client) {
          localStorage.setItem('token', response.access_token);
          localStorage.setItem('user', JSON.stringify(response.user));
        }

        // Apply theme preference
        this.applyTheme();

        return { success: true };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.data?.message || 'Login failed' 
        };
      }
    },

    logout() {
      this.user = null;
      this.token = null;
      this.isAuthenticated = false;

      if (import.meta.client) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        document.documentElement.removeAttribute('data-theme');
      }

      navigateTo('/');
    },

    async updatePreferences(preferences: Partial<UserPreferences>) {
      const config = useRuntimeConfig();
      try {
        await $fetch(`${config.public.apiBase}/users/preferences`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
          body: preferences,
        });

        if (this.user) {
          this.user.preferences = {
            ...this.user.preferences,
            ...preferences,
          } as UserPreferences;

          if (import.meta.client) {
            localStorage.setItem('user', JSON.stringify(this.user));
          }
        }

        this.applyTheme();
        return { success: true };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.data?.message || 'Failed to update preferences' 
        };
      }
    },

    applyTheme() {
      if (import.meta.client) {
        const theme = this.user?.preferences?.theme || 'light';
        if (theme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      }
    },

    initFromStorage() {
      if (import.meta.client) {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
          try {
            this.token = token;
            this.user = JSON.parse(userStr);
            this.isAuthenticated = true;
            this.applyTheme();
          } catch {
            this.logout();
          }
        }
      }
    },
  },
});
