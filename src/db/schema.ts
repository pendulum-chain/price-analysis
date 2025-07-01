import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const priceData = sqliteTable('price_data', {
  id: integer('id').primaryKey(),
  timestamp: text('timestamp').notNull(),
  source: text('source').notNull(),
  currency_pair: text('currency_pair').notNull(),
  amount: text('amount').notNull(),
  rate: text('rate').notNull(),
});
