import type { DbEngineAdapter } from "./index";

function authUri(conn: { host: string; port: number; username: string; password: string }): string {
  return `mongodb://${encodeURIComponent(conn.username)}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/admin`;
}

export const mongodbAdapter: DbEngineAdapter = {
  defaultPort: 27017,

  async testConnection(conn) {
    try {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(authUri(conn));
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      await client.close();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },

  async createDatabase(conn, opts) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(authUri(conn));
    await client.connect();
    try {
      await client.db(opts.database).command({
        createUser: opts.username,
        pwd: opts.password,
        roles: [{ role: "readWrite", db: opts.database }],
      });
    } finally {
      await client.close();
    }
  },

  async rotatePassword(conn, opts) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(authUri(conn));
    await client.connect();
    try {
      await client.db(opts.database ?? "admin").command({
        updateUser: opts.username,
        pwd: opts.newPassword,
      });
    } finally {
      await client.close();
    }
  },

  async dropDatabase(conn, opts) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(authUri(conn));
    await client.connect();
    try {
      await client
        .db(opts.database)
        .command({ dropUser: opts.username })
        .catch(() => {});
      await client.db(opts.database).dropDatabase();
    } finally {
      await client.close();
    }
  },

  formatConnectionString(opts) {
    return `mongodb://${encodeURIComponent(opts.username)}:${encodeURIComponent(opts.password)}@${opts.host}:${opts.port}/${opts.database}`;
  },
};
