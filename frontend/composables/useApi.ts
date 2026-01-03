/**
 * Composable for making authenticated API requests
 * Automatically handles 401 errors and adds auth headers
 */
export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const apiFetch = async <T>(url: string, options: any = {}): Promise<T> => {
    // Check if token is still valid before making request
    if (authStore.token && !authStore.isTokenValid) {
      console.warn('Token expired before request. Logging out...');
      authStore.logout();
      throw new Error('Session expired. Please log in again.');
    }

    const headers = {
      ...options.headers,
    };

    // Add authorization header if token exists
    if (authStore.token) {
      headers.Authorization = `Bearer ${authStore.token}`;
    }

    try {
      const response = await $fetch<T>(`${config.public.apiBase}${url}`, {
        ...options,
        headers,
      });
      return response;
    } catch (error: any) {
      // Handle 401 errors specifically
      if (error.response?.status === 401 || error.status === 401) {
        console.warn('Authentication failed. Logging out...');
        authStore.logout();
        throw new Error('Session expired. Please log in again.');
      }
      throw error;
    }
  };

  return {
    apiFetch,
  };
};
