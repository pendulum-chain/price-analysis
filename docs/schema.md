# Database Schema: `price_data`

This document outlines the schema for the `price_data` table, which is designed to store time-series data of currency exchange rates from various sources.

## Table: `price_data`

| Column Name     | Data Type         | Description                                                                 |
| :-------------- | :---------------- | :-------------------------------------------------------------------------- |
| `id`            | `BIGINT`          | Primary Key. A unique identifier for each record.                           |
| `timestamp`     | `TIMESTAMPTZ`     | The time when the rate was recorded (with timezone).                        |
| `source`        | `VARCHAR(255)`    | The source of the rate (e.g., 'Binance', 'Uniswap', 'Pendulum', 'Vortex').   |
| `currency_pair` | `VARCHAR(255)`    | The currency pair for which the rate is quoted (e.g., 'BRL-USDT').          |
| `amount`        | `DECIMAL(20, 8)`  | The amount for which the rate was fetched (e.g., 1000, 10000, 100000).       |
| `rate`          | `DECIMAL(20, 8)`  | The exchange rate.                                                          |

### Mermaid Diagram

```mermaid
erDiagram
    price_data {
        BIGINT id PK
        TIMESTAMPTZ timestamp
        VARCHAR source
        VARCHAR currency_pair
        DECIMAL amount
        DECIMAL rate
    }
