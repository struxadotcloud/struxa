type DatabaseEngineType = "mysql" | "mariadb" | "postgresql" | "mongodb" | "redis";

export function formatConnectionString(
  type: DatabaseEngineType,
  opts: { username: string; password: string; host: string; port: number; database: string },
): string {
  const username = encodeURIComponent(opts.username);
  const password = encodeURIComponent(opts.password);
  if (type === "redis") {
    return `redis://${username}:${password}@${opts.host}:${opts.port}`;
  }
  const scheme = type === "mysql" || type === "mariadb" ? "mysql" : type;
  return `${scheme}://${username}:${password}@${opts.host}:${opts.port}/${opts.database}`;
}
