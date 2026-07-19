import type { DbEngineAdapter } from "./index";

function quoteIdent(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

export const mysqlAdapter: DbEngineAdapter = {
  defaultPort: 3306,

  async testConnection(conn) {
    try {
      const mysql = await import("mysql2/promise");
      const connection = await mysql.createConnection({
        host: conn.host,
        port: conn.port,
        user: conn.username,
        password: conn.password,
      });
      await connection.ping();
      await connection.end();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async createDatabase(conn, opts) {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
      host: conn.host,
      port: conn.port,
      user: conn.username,
      password: conn.password,
    });
    const remote = opts.remote ?? "%";
    // CREATE/ALTER/DROP USER don't accept bind parameters ($1-style `?`) for the
    // user/host/password literals, so they're inlined via the driver's own
    // escaping (connection.escape quotes + escapes) instead. Identifiers (the
    // database name) use backtick-quoting with doubled internal backticks.
    try {
      await connection.execute(`CREATE DATABASE IF NOT EXISTS ${quoteIdent(opts.database)}`);
      await connection.execute(
        `CREATE USER IF NOT EXISTS ${connection.escape(opts.username)}@${connection.escape(remote)} IDENTIFIED BY ${connection.escape(opts.password)}`,
      );
      await connection.execute(
        `GRANT ALL PRIVILEGES ON ${quoteIdent(opts.database)}.* TO ${connection.escape(opts.username)}@${connection.escape(remote)}`,
      );
      await connection.execute("FLUSH PRIVILEGES");
    } finally {
      await connection.end();
    }
  },

  async rotatePassword(conn, opts) {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
      host: conn.host,
      port: conn.port,
      user: conn.username,
      password: conn.password,
    });
    const remote = opts.remote ?? "%";
    try {
      await connection.execute(
        `ALTER USER ${connection.escape(opts.username)}@${connection.escape(remote)} IDENTIFIED BY ${connection.escape(opts.newPassword)}`,
      );
      await connection.execute("FLUSH PRIVILEGES");
    } finally {
      await connection.end();
    }
  },

  async dropDatabase(conn, opts) {
    const mysql = await import("mysql2/promise");
    const connection = await mysql.createConnection({
      host: conn.host,
      port: conn.port,
      user: conn.username,
      password: conn.password,
    });
    const remote = opts.remote ?? "%";
    try {
      await connection.execute(`DROP USER IF EXISTS ${connection.escape(opts.username)}@${connection.escape(remote)}`);
      await connection.execute(`DROP DATABASE IF EXISTS ${quoteIdent(opts.database)}`);
      await connection.execute("FLUSH PRIVILEGES");
    } finally {
      await connection.end();
    }
  },

  formatConnectionString(opts) {
    return `mysql://${opts.username}:${opts.password}@${opts.host}:${opts.port}/${opts.database}`;
  },
};
