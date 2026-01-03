export default defineNuxtPlugin({
  name: 'api-error-handler',
  enforce: 'pre',
  setup() {
    const authStore = useAuthStore();

    // Intercept all $fetch calls globally
    if (import.meta.client) {
      const originalFetch = globalThis.$fetch;
      
      globalThis.$fetch = new Proxy(originalFetch, {
        apply(target, thisArg, argumentsList) {
          const [url, options = {}] = argumentsList;
          
          // Add error handling to the options
          const enhancedOptions = {
            ...options,
            onResponseError: (context: any) => {
              // Call original error handler if exists
              if (options.onResponseError) {
                options.onResponseError(context);
              }
              
              // Handle 401 errors
              if (context.response?.status === 401) {
                console.warn('Authentication expired. Logging out...');
                authStore.logout();
              }
            },
          };
          
          return Reflect.apply(target, thisArg, [url, enhancedOptions]);
        },
      });
    }
  },
});
