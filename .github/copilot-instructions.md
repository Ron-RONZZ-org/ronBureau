# Copilot Instructions for RonBureau

RonBureau is a Modern User Management System built with Nuxt.js, Nest.js, and Prisma with PostgreSQL.

## Tech Stack

### Frontend (Nuxt.js 3 / Vue 3)

- **Framework**: Nuxt.js 3 with Vue 3
- **State Management**: Pinia (`@pinia/nuxt`)
- **Utilities**: VueUse (`@vueuse/core`)
- **Routing**: Vue Router (auto-configured by Nuxt)

### Backend (Nest.js)

- **Framework**: Nest.js with TypeScript
- **ORM**: Prisma with PostgreSQL
- **Authentication**: JWT via Passport.js (`@nestjs/jwt`, `@nestjs/passport`)
- **Validation**: class-validator, class-transformer

## Project Structure

```
ronBureau/
├── .github/               # GitHub configuration and Copilot instructions
├── backend/               # Nest.js API server
│   ├── prisma/           # Database schema and migrations
│   └── src/              # Source code
│       ├── auth/         # Authentication module
│       ├── prisma/       # Prisma service module
│       └── users/        # User management module
├── frontend/             # Nuxt.js application
│   ├── assets/           # CSS styles
│   ├── components/       # Vue components
│   ├── composables/      # Vue composables
│   ├── layouts/          # Page layouts
│   ├── pages/            # Application pages
│   ├── stores/           # Pinia stores
│   └── nuxt.config.ts    # Nuxt configuration (centralized imports)
└── README.md
```

## Import Centralization Guidelines

### Frontend

Centralize imports from `node_modules` in `nuxt.config.ts` for clarity:

- **Nuxt Modules**: Register all Nuxt modules (like `@pinia/nuxt`) in the `modules` array of `nuxt.config.ts`
- **CSS/Assets**: Global CSS files should be registered in the `css` array of `nuxt.config.ts`
- **Auto-imports**: Nuxt auto-imports composables from `/composables`, utilities from Vue, and components from `/components`
- **Runtime Config**: Environment variables and API endpoints should be configured in `runtimeConfig`

Example `nuxt.config.ts` pattern:

```typescript
export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],           // Centralized module imports
  css: ['~/assets/css/main.css'],     // Centralized CSS imports
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3001',
    },
  },
})
```

### Backend

Centralize imports in Nest.js modules:

- **Module Imports**: Each feature module should import its dependencies in the `imports` array
- **Providers**: Services should be registered in the `providers` array of their respective modules
- **Exports**: Services that need to be shared across modules should be in the `exports` array
- **Global Modules**: Shared services like `PrismaService` should be in a global module imported at `AppModule` level

Example module pattern:

```typescript
@Module({
  imports: [PrismaModule, OtherModule],  // Centralized module imports
  controllers: [FeatureController],
  providers: [FeatureService],
  exports: [FeatureService],              // Export for use in other modules
})
export class FeatureModule {}
```

## Coding Conventions

### Frontend

- Use `<script setup lang="ts">` syntax in Vue components
- Use composables for reusable logic (place in `/composables`)
- Use Pinia stores for state management (place in `/stores`)
- Use TypeScript interfaces for type definitions
- Use `~/` alias for imports from project root

### Backend

- Follow Nest.js module pattern (Controller, Service, Module)
- Use DTOs with class-validator decorators for request validation
- Use Prisma Client for database operations
- Handle errors with Nest.js built-in exception filters

## Development Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Update DATABASE_URL in .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Test Users

| User ID   | Password    | Type               | Status    |
|-----------|-------------|-------------------|-----------|
| admin     | password123 | Administrator     | Active    |
| owner     | password123 | Organization Owner| Active    |
| user1     | password123 | User              | Active    |
| suspended | password123 | User              | Suspended |
| expired   | password123 | User              | Expired   |
