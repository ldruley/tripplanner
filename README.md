# TripPlanner

A comprehensive trip planning application built with modern web technologies. Plan your trips, discover locations, and optimize your travel routes with integrated mapping and point-of-interest services.

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

Built with Nx monorepo for scalable development.

## Features

- **Trip Planning**: Create and manage detailed trip itineraries
- **Location Discovery**: Search and discover points of interest
- **Route Optimization**: Calculate optimal travel routes and distances
- **User Management**: Secure authentication with email verification
- **Profile Management**: Customize user profiles and preferences
- **Multi-Provider Support**: Integrated with HERE and Mapbox APIs
- **Dark/Light Theme**: Responsive design with theme switching
- **Real-time Updates**: Background processing for time-sensitive operations

## Tech Stack

### Frontend
- **Angular 19** with standalone components and signals
- **Tailwind CSS** for styling
- **RxJS** for reactive programming
- **Storybook** for component documentation

### Backend
- **NestJS** with TypeScript
- **PostgreSQL** with Prisma ORM
- **Redis** for caching and session management
- **BullMQ** for background job processing
- **JWT** authentication with email verification

### External Services
- **HERE Maps API** for geocoding and routing
- **Mapbox API** for geocoding and routing
- **Email Service** for user notifications

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis server
- HERE and/or Mapbox API keys

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (create `.env` files based on examples)

4. Set up the database:
   ```bash
   npm run db:generate
   npm run db:push
   ```

### Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

Or start them individually:
```bash
# Frontend only
npm run start:frontend

# Backend only
npm run start:backend
```

### Building for Production

```bash
npm run build:frontend
npm run build:backend
```

## Project Structure

This is an Nx monorepo with the following structure:

- `apps/trip-frontend/` - Angular frontend application
- `apps/trip-backend/` - NestJS backend application
- `libs/` - Shared libraries and domain modules
  - `auth/` - Authentication utilities
  - `geocoding/` - Location and geocoding services
  - `email/` - Email service and templates
  - `shared/` - Common types, DTOs, and utilities

## Database Management

```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database (development)
npm run db:push

# Create and run migrations (production)
npm run db:migrate

# Open Prisma Studio
npm run db:studio
```

## Testing

```bash
# Unit tests
nx test trip-frontend
nx test trip-backend

# E2E tests
nx e2e trip-frontend-e2e
nx e2e trip-backend-e2e

# Linting
nx lint trip-frontend
nx lint trip-backend
```

## Development Tools

### Nx Commands

```bash
# Visualize project dependencies
nx graph

# Show available tasks for a project
nx show project trip-frontend

# Generate new components/libraries
nx g @nx/angular:component <name>
nx g @nx/angular:lib <name>
```

### Nx Console

Install [Nx Console](https://nx.dev/getting-started/editor-setup) for VS Code or IntelliJ to get enhanced IDE support for running tasks and generating code.

## License

MIT
