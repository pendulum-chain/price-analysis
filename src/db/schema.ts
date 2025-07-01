import { DataTypes, Model } from 'sequelize';
import sequelize from './index';

export interface PriceDataAttributes {
  id: number;
  timestamp: Date;
  source: string;
  currency_pair: string;
  amount: number;
  rate: number;
}

class PriceData extends Model<PriceDataAttributes> implements PriceDataAttributes {
  declare id: number;
  declare timestamp: Date;
  declare source: string;
  declare currency_pair: string;
  declare amount: number;
  declare rate: number;
}

PriceData.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    currency_pair: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'price_data',
    timestamps: false,
  }
);

export default PriceData;
