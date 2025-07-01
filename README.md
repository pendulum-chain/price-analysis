# price-analysis

## Environment Variables

Before running the application, you need to create a `.env` file in the root directory and provide the required environment variables. You can use the `.env.example` file as a template:

```bash
cp .env.example .env
```

Then, open the `.env` file and add your Alchemy API key and PostgreSQL database connection details:

```
ALCHEMY_API_KEY=your_alchemy_api_key
DB_HOST=localhost
DB_PORT=5432
DB_USER=user
DB_PASSWORD=password
DB_NAME=price_analysis
```

## Installation

To install dependencies:

```bash
bun install
```

## Database Migration

Before running the application for the first time, you need to initialize the database by running the migration script. This will create the `price_data` table.

```bash
bun run db:migrate
```

## Running the Application

To run the main application:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.6. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
