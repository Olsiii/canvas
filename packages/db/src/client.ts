import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://canvas:canvas@localhost:5432/canvas",
});

export const db = drizzle(pool, { schema });
