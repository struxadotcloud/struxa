import type { DbEngineAdapter } from "./index";

export const redisAdapter: DbEngineAdapter = {
  defaultPort: 6379,

  async testConnection(conn) {
    try {
      const { Redis } = await import("ioredis");
      const client = new Redis({
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password: conn.password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await client.connect();
      await client.ping();
      client.disconnect();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async createDatabase(conn, opts) {
    const { Redis } = await import("ioredis");
    const client = new Redis({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await client.connect();
    try {
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
    const { Redis } = await import("ioredis");
    const client = new Redis({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await client.connect();
    try {
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
    const { Redis } = await import("ioredis");
    const client = new Redis({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      password: conn.password,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await client.connect();
    try {
      await client.call("ACL", "DELUSER", opts.username);
    } finally {
      client.disconnect();
    }
  },

  formatConnectionString(opts) {
    return `redis://${opts.username}:${opts.password}@${opts.host}:${opts.port}`;
  },
};
