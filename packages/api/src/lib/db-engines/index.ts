import type { DatabaseEngineType } from "@struxa/db";
import { mysqlAdapter } from "./mysql";
import { postgresqlAdapter } from "./postgresql";
import { mongodbAdapter } from "./mongodb";
import { redisAdapter } from "./redis";

export interface DbHostConn {
  host: string;
  port: number;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface DbEngineAdapter {
  defaultPort: number;
  testConnection(conn: DbHostConn): Promise<{ ok: boolean; error?: string }>;
  createDatabase(
    conn: DbHostConn,
    opts: { database: string; username: string; password: string; remote?: string },
  ): Promise<void>;
  rotatePassword(
    conn: DbHostConn,
    opts: { username: string; newPassword: string; remote?: string; database?: string },
  ): Promise<void>;
  dropDatabase(
    conn: DbHostConn,
    opts: { database: string; username: string; remote?: string },
  ): Promise<void>;
  formatConnectionString(opts: {
    username: string;
    password: string;
    host: string;
    port: number;
    database: string;
  }): string;
}

export const dbEngines: Record<DatabaseEngineType, DbEngineAdapter> = {
  mysql: mysqlAdapter,
  mariadb: mysqlAdapter,
  postgresql: postgresqlAdapter,
  mongodb: mongodbAdapter,
  redis: redisAdapter,
};
