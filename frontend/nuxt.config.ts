// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@pinia/nuxt'],
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3001',
      graphhopperApiKey: process.env.GRAPHHOPPER_API_KEY || '',
      maptilerApiKey: process.env.MAPTILER_API_KEY || '',
    },
  },
  app: {
    head: {
      title: 'RonBureau',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'RonBureau - Modern User Management' },
      ],
    },
  },
  css: ['~/assets/css/main.css', 'ol/ol.css'],
})
