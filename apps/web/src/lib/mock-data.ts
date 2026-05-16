export type ServerStatus = "running" | "stopped" | "starting" | "stopping";

export type GameServer = {
  id: string;
  name: string;
  game: "minecraft" | "rust" | "cs2" | "tf2" | "ark";
  status: ServerStatus;
  node: string;
  ip: string;
  port: number;
  players: { current: number; max: number };
  resources: {
    cpu: number;
    ram: { used: number; total: number };
    disk: { used: number; total: number };
  };
  uptime: string | null;
};

export const mockServers: GameServer[] = [
  {
    id: "srv-001",
    name: "WaffleSMP",
    game: "minecraft",
    status: "running",
    node: "eu-west-1a",
    ip: "82.23.170.72",
    port: 27011,
    players: { current: 12, max: 20 },
    resources: { cpu: 34, ram: { used: 945, total: 4096 }, disk: { used: 253, total: 10240 } },
    uptime: "2d 4h 17m",
  },
  {
    id: "srv-002",
    name: "RustIsland",
    game: "rust",
    status: "running",
    node: "eu-central-2b",
    ip: "45.77.12.8",
    port: 28015,
    players: { current: 47, max: 100 },
    resources: { cpu: 72, ram: { used: 6200, total: 8192 }, disk: { used: 1800, total: 20480 } },
    uptime: "5d 11h 3m",
  },
  {
    id: "srv-003",
    name: "CounterStrike",
    game: "cs2",
    status: "stopped",
    node: "eu-west-1a",
    ip: "82.23.170.15",
    port: 27015,
    players: { current: 0, max: 10 },
    resources: { cpu: 0, ram: { used: 0, total: 2048 }, disk: { used: 512, total: 5120 } },
    uptime: null,
  },
  {
    id: "srv-004",
    name: "ArkSurvival",
    game: "ark",
    status: "starting",
    node: "na-east-1c",
    ip: "104.200.31.44",
    port: 7777,
    players: { current: 0, max: 30 },
    resources: { cpu: 15, ram: { used: 4100, total: 16384 }, disk: { used: 4800, total: 51200 } },
    uptime: null,
  },
  {
    id: "srv-005",
    name: "TF2 Classic",
    game: "tf2",
    status: "running",
    node: "eu-central-2b",
    ip: "45.77.12.33",
    port: 27015,
    players: { current: 8, max: 24 },
    resources: { cpu: 18, ram: { used: 820, total: 2048 }, disk: { used: 180, total: 5120 } },
    uptime: "1d 2h 44m",
  },
];

export type ConsoleLineType = "output" | "prompt" | "system";

export interface ConsoleLine {
  time: string;
  type: ConsoleLineType;
  text: string;
}

export const mockConsoleLines: ConsoleLine[] = [
  { time: "", type: "system", text: "You reached the start of the range → Jan 30, 2026, 23:33:46" },
  { time: "16:33:14", type: "output", text: "Server marked as Running" },
  { time: "16:33:14", type: "prompt", text: "container@struxa.host~ java -version" },
  { time: "16:33:14", type: "output", text: 'openjdk version "21.0.9" 2025-10-21 LTS' },
  {
    time: "16:33:14",
    type: "output",
    text: "OpenJDK Runtime Environment Temurin-21.0.9+10 (build 21.0.9+10-LTS)",
  },
  {
    time: "16:33:14",
    type: "output",
    text: "OpenJDK 64-Bit Server VM Temurin-21.0.9+10 (build 21.0.9+10-LTS, mixed mode, sharing)",
  },
  { time: "16:33:14", type: "prompt", text: "container@struxa.host~ Skipping malware scan..." },
  {
    time: "16:33:17",
    type: "output",
    text: "Ignoring hosts properties. All need to be set: minecraft.api.session.host",
  },
  { time: "16:33:19", type: "output", text: "Loaded 1470 recipes" },
  { time: "16:33:19", type: "output", text: "Loaded 1584 advancements" },
  { time: "16:33:19", type: "output", text: "Starting minecraft server version 1.21.11" },
  { time: "16:33:20", type: "output", text: "Default game type: SURVIVAL" },
  { time: "16:33:20", type: "output", text: "Generating keypair" },
  { time: "16:33:21", type: "output", text: "Starting Minecraft server on 0.0.0.0:27011" },
  {
    time: "16:33:21",
    type: "output",
    text: "Paper: Using libdeflate (Linux x86_64) compression from Velocity.",
  },
  {
    time: "16:33:21",
    type: "output",
    text: "Server permissions file permissions.yml is empty, ignoring it",
  },
  { time: "16:33:21", type: "output", text: 'Preparing level "world"' },
  {
    time: "16:33:21",
    type: "output",
    text: "Loading 0 persistent chunks for world 'minecraft:overworld'...",
  },
  {
    time: "16:33:21",
    type: "output",
    text: "Loading 0 persistent chunks for world 'minecraft:the_nether'...",
  },
  {
    time: "16:33:21",
    type: "output",
    text: "Loading 0 persistent chunks for world 'minecraft:the_end'...",
  },
  { time: "16:33:21", type: "output", text: 'Done preparing level "world" (0.340s)' },
  { time: "16:33:21", type: "output", text: "[spark] Starting background profiler..." },
];

export const mockNetworkIn: number[] = [
  0, 0, 2, 5, 3, 8, 12, 6, 3, 0, 0, 1, 4, 18, 22, 15, 8, 3, 0, 0, 0, 1, 3, 5, 2, 0, 0, 1, 0, 0,
];
export const mockNetworkOut: number[] = [
  0, 1, 3, 2, 4, 6, 9, 4, 2, 1, 0, 0, 2, 10, 14, 12, 7, 2, 1, 0, 0, 0, 2, 4, 1, 0, 0, 0, 1, 0,
];
export const mockCpuHistory: number[] = [
  28, 32, 45, 38, 29, 34, 42, 48, 35, 30, 28, 33, 40, 45, 39, 34, 31, 28, 35, 42, 38, 33, 30, 34,
  36, 38, 34, 35, 33, 34,
];
export const mockRamHistory: number[] = [
  920, 935, 940, 938, 942, 945, 950, 948, 943, 940, 938, 942, 945, 948, 946, 944, 940, 943, 946,
  945, 944, 946, 945, 943, 944, 946, 945, 944, 945, 945,
];
export const mockDiskHistory: number[] = [
  240, 241, 243, 244, 245, 245, 246, 247, 247, 248, 248, 249, 249, 250, 250, 251, 251, 251, 252,
  252, 252, 252, 253, 253, 253, 253, 253, 253, 253, 253,
];

export type FileItemType = "file" | "directory";

export interface FileItem {
  name: string;
  type: FileItemType;
  size?: number;
  modified: string;
  path: string;
  content?: string;
  mimeType?: string;
  children?: FileItem[];
}

export const mockFileTree: FileItem[] = [
  {
    name: "plugins",
    type: "directory",
    modified: "Jan 30, 2026",
    path: "/plugins",
    children: [
      {
        name: "EssentialsX.jar",
        type: "file",
        size: 1843200,
        modified: "Jan 12, 2026",
        path: "/plugins/EssentialsX.jar",
        mimeType: "application/java-archive",
      },
      {
        name: "LuckPerms.jar",
        type: "file",
        size: 2097152,
        modified: "Jan 15, 2026",
        path: "/plugins/LuckPerms.jar",
        mimeType: "application/java-archive",
      },
    ],
  },
  {
    name: "world",
    type: "directory",
    modified: "Jan 30, 2026",
    path: "/world",
    children: [
      {
        name: "level.dat",
        type: "file",
        size: 8192,
        modified: "Jan 30, 2026",
        path: "/world/level.dat",
        mimeType: "application/octet-stream",
      },
    ],
  },
  {
    name: "logs",
    type: "directory",
    modified: "Jan 30, 2026",
    path: "/logs",
    children: [
      {
        name: "latest.log",
        type: "file",
        size: 45312,
        modified: "Jan 30, 2026",
        path: "/logs/latest.log",
        mimeType: "text/plain",
        content: `[16:33:14 INFO]: Starting minecraft server version 1.21.11
[16:33:14 INFO]: Loading properties
[16:33:14 INFO]: Default game type: SURVIVAL
[16:33:15 INFO]: Preparing level "world"
[16:33:21 INFO]: Done (7.340s)! For help, type "help"`,
      },
    ],
  },
  {
    name: "server.properties",
    type: "file",
    size: 1024,
    modified: "Jan 28, 2026",
    path: "/server.properties",
    mimeType: "text/plain",
    content: `#Minecraft server properties
#Thu Jan 30 2026
enable-jmx-monitoring=false
rcon.port=25575
level-seed=
gamemode=survival
enable-command-block=false
enable-query=false
generator-settings={}
enforce-secure-profile=true
level-name=world
motd=A Minecraft Server
query.port=25565
pvp=true
generate-structures=true
max-chained-neighbor-updates=1000000
difficulty=easy
network-compression-threshold=256
max-tick-time=60000
require-resource-pack=false
use-native-transport=true
max-players=20
online-mode=true
enable-status=true
allow-flight=false
initial-disabled-packs=
broadcast-rcon-to-ops=true
view-distance=10
server-ip=
resource-pack-prompt=
allow-nether=true
server-port=25565
enable-rcon=false
sync-chunk-writes=true
op-permission-level=4
prevent-proxy-connections=false
hide-online-players=false
resource-pack=
entity-broadcast-range-percentage=100
simulation-distance=10
rcon.password=
player-idle-timeout=0
debug=false
force-gamemode=false
rate-limit=0
hardcore=false
white-list=false
broadcast-console-to-ops=true
spawn-npcs=true
spawn-animals=true
log-ips=true
function-permission-level=2
level-type=minecraft\\:normal
text-filtering-config=
spawn-monsters=true
enforce-whitelist=false
spawn-protection=16
max-world-size=29999984`,
  },
  {
    name: "ops.json",
    type: "file",
    size: 256,
    modified: "Jan 20, 2026",
    path: "/ops.json",
    mimeType: "application/json",
    content: `[
  {
    "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
    "name": "Notch",
    "level": 4,
    "bypassesPlayerLimit": false
  }
]`,
  },
  {
    name: "eula.txt",
    type: "file",
    size: 512,
    modified: "Jan 10, 2026",
    path: "/eula.txt",
    mimeType: "text/plain",
    content: `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).
#Thu Jan 10 2026
eula=true`,
  },
  {
    name: "banner.png",
    type: "file",
    size: 204800,
    modified: "Jan 15, 2026",
    path: "/banner.png",
    mimeType: "image/png",
  },
];

// ── Databases ──────────────────────────────────────────────────────────────

export interface MockDatabase {
  id: string;
  name: string;
  username: string;
  password: string;
  host: string;
  port: number;
}

export const mockDatabases: MockDatabase[] = [
  {
    id: "db-001",
    name: "s1_luckperms",
    username: "u1_luckperms",
    password: "Xk9#mPqR2vL7",
    host: "db.eu-west-1a.struxa.host",
    port: 3306,
  },
  {
    id: "db-002",
    name: "s1_economy",
    username: "u1_economy",
    password: "Tz4!nWjY8cF1",
    host: "db.eu-west-1a.struxa.host",
    port: 3306,
  },
  {
    id: "db-003",
    name: "s1_playerstats",
    username: "u1_playerstats",
    password: "Rq6@kHsD3bG5",
    host: "db.eu-west-1a.struxa.host",
    port: 3306,
  },
];

// ── Schedules ──────────────────────────────────────────────────────────────

export interface MockSchedule {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string;
  action: string;
}

export const mockSchedules: MockSchedule[] = [
  {
    id: "sch-001",
    name: "Daily Restart",
    cron: "0 6 * * *",
    enabled: true,
    lastRun: "May 15, 2026 06:00",
    nextRun: "May 16, 2026 06:00",
    action: "Restart server",
  },
  {
    id: "sch-002",
    name: "Hourly Backup",
    cron: "0 * * * *",
    enabled: true,
    lastRun: "May 16, 2026 04:00",
    nextRun: "May 16, 2026 05:00",
    action: "Create backup",
  },
  {
    id: "sch-003",
    name: "Weekly Cleanup",
    cron: "0 3 * * 0",
    enabled: false,
    lastRun: "May 11, 2026 03:00",
    nextRun: "May 18, 2026 03:00",
    action: "Run command: /cleanup",
  },
  {
    id: "sch-004",
    name: "Save World",
    cron: "*/15 * * * *",
    enabled: true,
    lastRun: "May 16, 2026 04:45",
    nextRun: "May 16, 2026 05:00",
    action: "Run command: /save-all",
  },
];

// ── Subusers ───────────────────────────────────────────────────────────────

export type SubuserPermission =
  | "console"
  | "files"
  | "backups"
  | "databases"
  | "schedules"
  | "users"
  | "network"
  | "startup"
  | "settings";

export interface MockSubuser {
  id: string;
  email: string;
  username: string;
  twoFactor: boolean;
  createdAt: string;
  permissions: SubuserPermission[];
}

export const mockSubusers: MockSubuser[] = [
  {
    id: "sub-001",
    email: "jakubkrzyz.kontakt@gmail.com",
    username: "jakub",
    twoFactor: true,
    createdAt: "Jan 10, 2026",
    permissions: [
      "console", "files", "backups", "databases",
      "schedules", "users", "network", "startup", "settings",
    ],
  },
  {
    id: "sub-002",
    email: "alex@example.com",
    username: "alexdev",
    twoFactor: false,
    createdAt: "Feb 3, 2026",
    permissions: ["console", "files", "backups"],
  },
  {
    id: "sub-003",
    email: "mod@wafflesmp.net",
    username: "wafflemod",
    twoFactor: true,
    createdAt: "Mar 18, 2026",
    permissions: ["console", "files"],
  },
];

// ── Backups ────────────────────────────────────────────────────────────────

export type BackupStatus = "complete" | "creating" | "failed";

export interface MockBackup {
  id: string;
  name: string;
  sizeMb: number;
  createdAt: string;
  status: BackupStatus;
}

export const mockBackups: MockBackup[] = [
  {
    id: "bak-001",
    name: "backup-2026-05-16-04-00.tar.gz",
    sizeMb: 267,
    createdAt: "May 16, 2026 04:00",
    status: "complete",
  },
  {
    id: "bak-002",
    name: "backup-2026-05-15-04-00.tar.gz",
    sizeMb: 264,
    createdAt: "May 15, 2026 04:00",
    status: "complete",
  },
  {
    id: "bak-003",
    name: "backup-2026-05-14-04-00.tar.gz",
    sizeMb: 261,
    createdAt: "May 14, 2026 04:00",
    status: "complete",
  },
  {
    id: "bak-004",
    name: "backup-2026-05-13-04-00.tar.gz",
    sizeMb: 0,
    createdAt: "May 13, 2026 04:00",
    status: "failed",
  },
  {
    id: "bak-005",
    name: "backup-2026-05-12-04-00.tar.gz",
    sizeMb: 258,
    createdAt: "May 12, 2026 04:00",
    status: "complete",
  },
];

// ── Allocations ────────────────────────────────────────────────────────────

export interface MockAllocation {
  id: string;
  ip: string;
  port: number;
  alias: string | null;
  primary: boolean;
}

export const mockAllocations: MockAllocation[] = [
  { id: "alloc-001", ip: "82.23.170.72", port: 27011, alias: "WaffleSMP", primary: true },
  { id: "alloc-002", ip: "82.23.170.72", port: 27012, alias: null, primary: false },
  { id: "alloc-003", ip: "82.23.170.72", port: 27013, alias: "RCON", primary: false },
];

// ── Activity log (panel audit) ─────────────────────────────────────────────

export interface MockActivity {
  id: string;
  ts: string;
  event: string;
  actor: string;
  ip: string;
}

export const mockActivityLog: MockActivity[] = [
  {
    id: "act-001",
    ts: "May 16, 2026 04:02",
    event: "server:backup.complete",
    actor: "system",
    ip: "—",
  },
  {
    id: "act-002",
    ts: "May 16, 2026 04:00",
    event: "server:backup.start",
    actor: "system",
    ip: "—",
  },
  {
    id: "act-003",
    ts: "May 16, 2026 03:12",
    event: "server:console.command",
    actor: "jakubkrzyz.kontakt@gmail.com",
    ip: "89.64.12.33",
  },
  {
    id: "act-004",
    ts: "May 16, 2026 01:44",
    event: "server:files.write",
    actor: "alexdev",
    ip: "212.77.100.5",
  },
  {
    id: "act-005",
    ts: "May 15, 2026 22:30",
    event: "server:files.write",
    actor: "jakubkrzyz.kontakt@gmail.com",
    ip: "89.64.12.33",
  },
  {
    id: "act-006",
    ts: "May 15, 2026 18:01",
    event: "server:power.stop",
    actor: "jakubkrzyz.kontakt@gmail.com",
    ip: "89.64.12.33",
  },
  {
    id: "act-007",
    ts: "May 15, 2026 06:00",
    event: "server:power.restart",
    actor: "system",
    ip: "—",
  },
  {
    id: "act-008",
    ts: "May 15, 2026 04:01",
    event: "server:backup.complete",
    actor: "system",
    ip: "—",
  },
  {
    id: "act-009",
    ts: "May 14, 2026 20:17",
    event: "server:power.start",
    actor: "jakubkrzyz.kontakt@gmail.com",
    ip: "89.64.12.33",
  },
  {
    id: "act-010",
    ts: "May 14, 2026 20:15",
    event: "user:login",
    actor: "jakubkrzyz.kontakt@gmail.com",
    ip: "89.64.12.33",
  },
];

// ── Server startup variables ───────────────────────────────────────────────

export interface MockServerVariable {
  name: string;
  envVar: string;
  description: string;
  value: string;
  rules: string;
}

export const mockServerVariables: MockServerVariable[] = [
  {
    name: "Server Version",
    envVar: "MINECRAFT_VERSION",
    description: "The version of Minecraft to download and run.",
    value: "1.21.11",
    rules: "required|string|max:20",
  },
  {
    name: "Server Jar URL",
    envVar: "SERVER_JARFILE",
    description: "The name of the server jarfile to run.",
    value: "server.jar",
    rules: "required|string|ends_with:.jar",
  },
  {
    name: "Build Number",
    envVar: "BUILD_NUMBER",
    description: "The Paper build number. Use 'latest' for the newest build.",
    value: "latest",
    rules: "required|string|max:20",
  },
];
