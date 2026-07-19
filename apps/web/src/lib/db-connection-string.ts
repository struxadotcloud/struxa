type DatabaseEngineType = "mysql" | "mariadb" | "postgresql" | "mongodb" | "redis";

export function formatConnectionString(
  type: DatabaseEngineType,
  opts: { username: string; password: string; host: string; port: number; database: string },
): string {
  if (type === "redis") {
    return `redis://${opts.username}:${opts.password}@${opts.host}:${opts.port}`;
  }
  const scheme = type === "mysql" || type === "mariadb" ? "mysql" : type;
  return `${scheme}://${opts.username}:${opts.password}@${opts.host}:${opts.port}/${opts.database}`;
}
