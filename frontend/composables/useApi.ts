/**
 * Composable for making authenticated API requests
 * Automatically adds auth headers and validates token before requests
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

    // The global plugin will handle 401 errors, so we just make the request
    return await $fetch<T>(`${config.public.apiBase}${url}`, {
      ...options,
      headers,
    });
  };

  return {
    apiFetch,
  };
};
