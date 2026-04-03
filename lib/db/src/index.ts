import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "[db] DATABASE_URL is not set — database features will be unavailable. " +
    "Add DATABASE_URL to your Vercel environment variables to enable persistence.",
  );
}

// pg.Pool is lazy — it won't attempt a real connection until a query is made,
// so an invalid/missing URL won't crash the server at startup.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://localhost/nodb",
});
export const db = drizzle(pool, { schema });

export * from "./schema";
