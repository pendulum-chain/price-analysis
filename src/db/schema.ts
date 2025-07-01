import { DataTypes, Model } from 'sequelize';
import sequelize from './index';

class PriceData extends Model {
  public id!: number;
  public timestamp!: Date;
  public source!: string;
  public currency_pair!: string;
  public amount!: number;
  public rate!: number;
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
