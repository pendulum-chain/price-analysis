import { Sequelize } from 'sequelize';
import { dbConfig } from '../config';

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  logging: console.log,
});

export default sequelize;
