# RonBureau

Modern User Management System built with Nuxt.js, Nest.js, and Prisma with PostgreSQL.

## Features

- **User Authentication**: Secure login system with JWT tokens
- **User Management**: Support for different user types (User, Administrator, Organization Owner)
- **User Dashboard**: Personalized dashboard with user preferences
- **Theme Support**: Dark/Light theme toggle
- **Date/Time Formats**: Configurable datetime display formats (ISO, Local, US, EU, Short)
- **Navigation Menu**: Clean navigation between pages
- **Responsive Design**: Modern, simple UI that works on all devices

## Tech Stack

- **Frontend**: Nuxt.js 3 with Vue 3
- **Backend**: Nest.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT (JSON Web Tokens)
- **State Management**: Pinia

## Project Structure

```
ronBureau/
├── backend/           # Nest.js API server
│   ├── prisma/       # Database schema and migrations
│   └── src/          # Source code
│       ├── auth/     # Authentication module
│       ├── users/    # User management module
│       └── prisma/   # Prisma service
├── frontend/         # Nuxt.js application
│   ├── assets/       # CSS styles
│   ├── components/   # Vue components
│   ├── composables/  # Vue composables
│   ├── layouts/      # Page layouts
│   ├── pages/        # Application pages
│   └── stores/       # Pinia stores
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Update the `DATABASE_URL` in `.env` with your PostgreSQL connection string.

5. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

6. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```

7. Seed the database with test data:
   ```bash
   npm run prisma:seed
   ```

8. Start the backend server:
   ```bash
   npm run start:dev
   ```

The backend API will be available at `http://localhost:3001`.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:3000`.

## Test Users

After running the seed script, the following test users will be available:

| User ID    | Password      | Type               | Status    |
|------------|---------------|-------------------|-----------|
| admin      | password123   | Administrator     | Active    |
| owner      | password123   | Organization Owner| Active    |
| user1      | password123   | User              | Active    |
| suspended  | password123   | User              | Suspended |
| expired    | password123   | User              | Expired   |

## User Schema

The User model includes the following fields:

- `id`: Unique identifier (UUID)
- `organizationId`: Organization identifier
- `displayName`: User's display name
- `userId`: Unique login identifier
- `userType`: USER, ADMINISTRATOR, or ORGANIZATION_OWNER
- `password`: Hashed password
- `accountValidFrom`: Account validity start date
- `accountValidUntil`: Account validity end date (optional)
- `status`: ACTIVE, SUSPENDED, or EXPIRED

## User Preferences

Users can customize their experience with:

- **Theme**: Light or Dark mode
- **Date/Time Format**: ISO (default), Local, US, EU, or Short format

## Pages

1. **Login Page** (`/`): User authentication
2. **Home Page** (`/home`): Welcome message and current datetime display
3. **Dashboard** (`/dashboard`): User profile and preferences management

## API Endpoints

- `POST /auth/login`: Authenticate user
- `GET /users/me`: Get current user profile
- `GET /users/preferences`: Get user preferences
- `PUT /users/preferences`: Update user preferences

## License

ISC