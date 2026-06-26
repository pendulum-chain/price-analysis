import sequelize from './index';
import PriceData from './schema';

type DatabaseIndex = {
  name?: string;
};

const ensureTimestampIndex = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const indexes = (await queryInterface.showIndex('price_data')) as DatabaseIndex[];
  const hasTimestampIndex = indexes.some((index) => index.name === 'price_data_timestamp_idx');

  if (!hasTimestampIndex) {
    await queryInterface.addIndex('price_data', ['timestamp'], {
      name: 'price_data_timestamp_idx',
      concurrently: true,
    });
    console.log('Index "price_data_timestamp_idx" created successfully.');
  }
};

const migrate = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    await PriceData.sync();
    console.log('Table "price_data" created successfully.');

    await ensureTimestampIndex();

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Unable to perform migration:', error);
    process.exit(1);
  }
};

migrate();
