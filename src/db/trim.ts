import sequelize from './index';
import { trimOldPriceData } from './retention';

const trim = async () => {
  try {
    await sequelize.authenticate();
    const deletedRows = await trimOldPriceData();
    console.log(`Trim completed. Deleted ${deletedRows} old price_data rows.`);
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Unable to trim old price_data rows:', error);
    await sequelize.close();
    process.exit(1);
  }
};

trim();
