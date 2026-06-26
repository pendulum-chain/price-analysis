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
PRICE_DATA_RETENTION_DAYS=90
PRICE_DATA_TRIM_BATCH_SIZE=10000
PRICE_DATA_TRIM_MAX_BATCHES_PER_RUN=1
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

The migration also ensures that `price_data.timestamp` has an index, which is required for efficient retention cleanup.

## Trimming Old Price Data

The service automatically removes old rows after storing new prices. By default, it keeps 90 days of `price_data` and deletes at most 10,000 old rows per run so startup work stays bounded.

For an existing large table, run the trim manually in controlled batches after running the migration:

```bash
bun run db:trim
```

To drain a large backlog faster, temporarily increase `PRICE_DATA_TRIM_MAX_BATCHES_PER_RUN` in `.env`, run `bun run db:trim`, then lower it again for normal service runs.

## Running the Application

To run the main application:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.6. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
