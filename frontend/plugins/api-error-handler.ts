export default defineNuxtPlugin((nuxtApp) => {
  const authStore = useAuthStore();

  // Global error handler for $fetch
  nuxtApp.hook('app:created', () => {
    const originalFetch = $fetch.create({
      onResponseError({ response }) {
        // Handle 401 Unauthorized errors
        if (response.status === 401) {
          // User's token has expired or is invalid
          console.warn('Authentication expired. Logging out...');
          authStore.logout();
        }
      },
    });

    // Make the custom fetch instance available globally
    nuxtApp.provide('apiFetch', originalFetch);
  });
});
