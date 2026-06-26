import 'dotenv/config';

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'require'].includes(value.toLowerCase());
};

export const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: parseBoolean(process.env.DB_SSL, false),
  sslCaPath: process.env.DB_SSL_CA_PATH,
  sslRejectUnauthorized: parseBoolean(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
};
