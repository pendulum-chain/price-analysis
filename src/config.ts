import 'dotenv/config';

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'require'].includes(value.toLowerCase());
};

const parseInteger = (value: string | undefined, defaultValue: number) => {
  if (value === undefined) {
    return defaultValue;
  }

  const parsedValue = parseInt(value, 10);
  return Number.isNaN(parsedValue) ? defaultValue : parsedValue;
};

export const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInteger(process.env.DB_PORT, 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: parseBoolean(process.env.DB_SSL, false),
  sslCaPath: process.env.DB_SSL_CA_PATH,
  sslRejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
};

export const retentionConfig = {
  days: parseInteger(process.env.PRICE_DATA_RETENTION_DAYS, 120),
  batchSize: parseInteger(process.env.PRICE_DATA_TRIM_BATCH_SIZE, 10000),
  maxBatchesPerRun: parseInteger(process.env.PRICE_DATA_TRIM_MAX_BATCHES_PER_RUN, 1),
};
