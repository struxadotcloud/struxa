import { env } from "@struxav2/env/server";
import { drizzle } from "drizzle-orm/mysql2";

import * as schema from "./schema";

export function createDb() {
  return drizzle({
    connection: {
      uri: env.DATABASE_URL,
    },
    schema,
  });
}

export const db = createDb();
