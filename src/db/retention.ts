import { QueryTypes } from 'sequelize';
import { retentionConfig } from '../config';
import sequelize from './index';

type DeletedRow = {
  id: string;
};

const getCutoffDate = () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionConfig.days);
  return cutoffDate;
};

export const trimOldPriceDataBatch = async () => {
  const deletedRows = await sequelize.query<DeletedRow>(
    `
      WITH rows_to_delete AS (
        SELECT id
        FROM price_data
        WHERE timestamp < :cutoffDate
        ORDER BY timestamp
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM price_data
      USING rows_to_delete
      WHERE price_data.id = rows_to_delete.id
      RETURNING price_data.id
    `,
    {
      replacements: {
        cutoffDate: getCutoffDate(),
        batchSize: retentionConfig.batchSize,
      },
      type: QueryTypes.SELECT,
    }
  );

  return deletedRows.length;
};

export const trimOldPriceData = async () => {
  let totalDeletedRows = 0;

  for (let batch = 0; batch < retentionConfig.maxBatchesPerRun; batch += 1) {
    const deletedRows = await trimOldPriceDataBatch();
    totalDeletedRows += deletedRows;

    if (deletedRows < retentionConfig.batchSize) {
      break;
    }
  }

  if (totalDeletedRows > 0) {
    console.log(`Deleted ${totalDeletedRows} price_data rows older than ${retentionConfig.days} days.`);
  }

  return totalDeletedRows;
};
