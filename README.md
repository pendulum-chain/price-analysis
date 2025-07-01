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

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.6. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
