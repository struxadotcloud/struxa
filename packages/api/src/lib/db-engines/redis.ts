import type { DbEngineAdapter, DbHostConn } from "./index";

async function createClient(conn: DbHostConn) {
  const { Redis } = await import("ioredis");
  return new Redis({
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password,
    tls: conn.ssl ? {} : undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
}

export const redisAdapter: DbEngineAdapter = {
  defaultPort: 6379,

  async testConnection(conn) {
    const client = await createClient(conn);
    try {
      await client.connect();
      await client.ping();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    } finally {
      client.disconnect();
    }
  },

  async createDatabase(conn, opts) {
    const client = await createClient(conn);
    try {
      await client.connect();
      // ponytail: no per-key isolation (~*), matches MySQL's GRANT ALL trust
      // model for this host type — a deliberate, confirmed simplification.
      await client.call(
        "ACL",
        "SETUSER",
        opts.username,
        "on",
        `>${opts.password}`,
        "~*",
        "+@all",
      );
    } finally {
      client.disconnect();
    }
  },

  async rotatePassword(conn, opts) {
    const client = await createClient(conn);
    try {
      await client.connect();
      await client.call(
        "ACL",
        "SETUSER",
        opts.username,
        "on",
        "resetpass",
        `>${opts.newPassword}`,
        "~*",
        "+@all",
      );
    } finally {
      client.disconnect();
    }
  },

  async dropDatabase(conn, opts) {
    const client = await createClient(conn);
    try {
      await client.connect();
      await client.call("ACL", "DELUSER", opts.username);
    } finally {
      client.disconnect();
    }
  },

  formatConnectionString(opts) {
    return `redis://${encodeURIComponent(opts.username)}:${encodeURIComponent(opts.password)}@${opts.host}:${opts.port}`;
  },
};
