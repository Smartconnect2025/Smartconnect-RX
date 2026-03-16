# TFA Components Foundation.

## Tech Stack

- [Next.js](https://nextjs.org) 15.2.3
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn UI](https://ui.shadcn.com/)
- [Supabase](https://supabase.com/)

## Documentation

For detailed information about the project architecture, file structure, and component organization,
please refer to:

- [Architecture Documentation](docs/01-architecture.md)

## Available Scripts

```bash
# Start the development server
npm run dev

# Build the application for production
npm run build

# Start the production server
npm run start

# Run linting
npm run lint
```

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result

## Database Management with Drizzle

This project uses Drizzle ORM for database schema management. Available scripts:

- Generate migrations:

  ```bash
  npm run db:generate migration_name
  ```

- Generate custom migrations (when the migration does not have a schema update):

  ```bash
  npm run db:generate-custom migration_name
  ```

- Apply migrations:

  ```bash
  npm run db:migrate
  ```

- Apply seed data:

  ```bash
  npm run db:seed
  ```

- Check migration status:
  ```bash
  npm run db:check
  ```
