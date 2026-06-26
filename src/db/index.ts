import { readFileSync } from 'node:fs';
import { Sequelize, type Options } from 'sequelize';
import { dbConfig } from '../config';

const sslOptions = dbConfig.ssl
  ? ({
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: dbConfig.sslRejectUnauthorized,
          ...(dbConfig.sslCaPath ? { ca: readFileSync(dbConfig.sslCaPath, 'utf8') } : {}),
        },
      },
    } satisfies Pick<Options, 'dialectOptions'>)
  : {};

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  logging: console.log,
  ...sslOptions,
});

export default sequelize;
