import { Pool } from "pg";

// Create a database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon’s SSL connection
  },
});

export const db = {
  query: (text: string, params?: (string | number)[]) =>
    pool.query(text, params),
};
