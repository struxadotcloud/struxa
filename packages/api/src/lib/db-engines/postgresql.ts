import type { DbEngineAdapter, DbHostConn } from "./index";

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// Postgres DDL (CREATE/ALTER ROLE) doesn't accept bind parameters ($1) for the
// password literal, so it must be inlined as an escaped string literal instead.
function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function clientConfig(conn: DbHostConn) {
  return {
    host: conn.host,
    port: conn.port,
    user: conn.username,
    password: conn.password,
    database: "postgres",
    // Mirrors libpq's sslmode=require: encrypt the connection, don't validate the
    // server certificate (operator-managed hosts commonly use self-signed certs).
    ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
  };
}

export const postgresqlAdapter: DbEngineAdapter = {
  defaultPort: 5432,

  async testConnection(conn) {
    try {
      const { Client } = await import("pg");
      const client = new Client(clientConfig(conn));
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async createDatabase(conn, opts) {
    const { Client } = await import("pg");
    const client = new Client(clientConfig(conn));
    await client.connect();
    try {
      await client.query(
        `CREATE ROLE ${quoteIdent(opts.username)} WITH LOGIN PASSWORD ${quoteLiteral(opts.password)}`,
      );
      await client.query(
        `CREATE DATABASE ${quoteIdent(opts.database)} OWNER ${quoteIdent(opts.username)}`,
      );
      await client.query(
        `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(opts.database)} TO ${quoteIdent(opts.username)}`,
      );
    } finally {
      await client.end();
    }
  },

  async rotatePassword(conn, opts) {
    const { Client } = await import("pg");
    const client = new Client(clientConfig(conn));
    await client.connect();
    try {
      await client.query(
        `ALTER ROLE ${quoteIdent(opts.username)} WITH PASSWORD ${quoteLiteral(opts.newPassword)}`,
      );
    } finally {
      await client.end();
    }
  },

  async dropDatabase(conn, opts) {
    const { Client } = await import("pg");
    const client = new Client(clientConfig(conn));
    await client.connect();
    try {
      await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(opts.database)}`);
      await client.query(`DROP ROLE IF EXISTS ${quoteIdent(opts.username)}`);
    } finally {
      await client.end();
    }
  },

  formatConnectionString(opts) {
    return `postgresql://${encodeURIComponent(opts.username)}:${encodeURIComponent(opts.password)}@${opts.host}:${opts.port}/${opts.database}`;
  },
};
