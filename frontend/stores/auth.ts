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
  tokenExpiry: number | null;
  isAuthenticated: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    tokenExpiry: null,
    isAuthenticated: false,
  }),

  getters: {
    currentUser: (state) => state.user,
    userPreferences: (state): UserPreferences => 
      state.user?.preferences || { theme: 'light', datetimeFormat: 'ISO' },
    isAdmin: (state) => 
      state.user?.userType === 'ADMINISTRATOR' || state.user?.userType === 'ORGANIZATION_OWNER',
    isTokenValid: (state) => {
      if (!state.token || !state.tokenExpiry) return false;
      return Date.now() < state.tokenExpiry;
    },
  },

  actions: {
    decodeToken(token: string): { exp?: number } {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch (error) {
        console.error('Failed to decode token:', error);
        return {};
      }
    },

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

        // Decode token to get expiration time
        const decoded = this.decodeToken(response.access_token);
        this.tokenExpiry = decoded.exp ? decoded.exp * 1000 : null;

        // Store token and expiry in localStorage
        if (import.meta.client) {
          localStorage.setItem('token', response.access_token);
          localStorage.setItem('tokenExpiry', this.tokenExpiry?.toString() || '');
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
      this.tokenExpiry = null;
      this.isAuthenticated = false;

      if (import.meta.client) {
        localStorage.removeItem('token');
        localStorage.removeItem('tokenExpiry');
        localStorage.removeItem('user');
        document.documentElement.removeAttribute('data-theme');
      }

      navigateTo('/');
    },

    async updatePreferences(preferences: Partial<UserPreferences>) {
      try {
        const { apiFetch } = useApi();
        await apiFetch('/users/preferences', {
          method: 'PUT',
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
          error: error.message || 'Failed to update preferences' 
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
        const tokenExpiry = localStorage.getItem('tokenExpiry');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
          try {
            this.token = token;
            this.tokenExpiry = tokenExpiry ? parseInt(tokenExpiry) : null;
            this.user = JSON.parse(userStr);

            // Check if token is still valid
            if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
              console.warn('Token has expired. Logging out...');
              this.logout();
              return;
            }

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
