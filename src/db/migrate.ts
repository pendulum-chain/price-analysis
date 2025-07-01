import PriceData from './schema';
import sequelize from './index';

const migrate = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    
    await PriceData.sync();
    console.log('Table "price_data" created successfully.');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Unable to perform migration:', error);
    process.exit(1);
  }
};

migrate();
