import { safeDecrypt } from "./crypto";

type WingsConfigNode = {
  uuid: string;
  tokenId: string;
  token: string;
  scheme: string;
  daemonListen: number;
  daemonSFTP: number;
  daemonBase: string;
  uploadSize: number;
};

export function buildWingsConfigYaml(
  node: WingsConfigNode,
  appUrl: string,
  opts?: { port?: number; sslEnabled?: boolean },
): string {
  const base = node.daemonBase;
  const sslEnabled = opts?.sslEnabled ?? node.scheme === "https";

  return `debug: false
app_name: Pterodactyl
uuid: ${node.uuid}
token_id: ${node.tokenId}
token: ${safeDecrypt(node.token)}
api:
  host: 0.0.0.0
  port: ${opts?.port ?? node.daemonListen}
  ssl:
    enabled: ${sslEnabled}
    cert: ''
    key: ''
  redirects: {}
  disable_openapi_docs: false
  disable_remote_download: false
  server_remote_download_limit: 3
  remote_download_blocked_cidrs:
  - 127.0.0.0/8
  - 10.0.0.0/8
  - 172.16.0.0/12
  - 192.168.0.0/16
  - 169.254.0.0/16
  - ::1
  - fe80::/10
  - fc00::/7
  disable_directory_size: false
  directory_entry_limit: 10000
  send_offline_server_logs: false
  file_search_threads: 4
  file_copy_threads: 4
  file_decompression_threads: 2
  file_compression_threads: 2
  upload_limit: ${node.uploadSize}
  max_jwt_uses: 5
  trusted_proxies: []
system:
  root_directory: ${base}
  log_directory: /var/log/pterodactyl
  vmount_directory: ${base}/vmounts
  data: ${base}
  archive_directory: ${base}/archives
  backup_directory: ${base}/backups
  tmp_directory: /tmp/pterodactyl
  username: pterodactyl
  timezone: UTC
  user:
    rootless:
      enabled: false
      container_uid: 0
      container_gid: 0
    uid: 988
    gid: 988
  passwd:
    enabled: false
    directory: /run/wings/etc
  machine_id:
    enabled: true
  disk_check_concurrency: 2
  disk_check_interval: 150
  full_disk_check_every: 4
  disk_check_use_inotify: true
  disk_limiter_mode: none
  activity_send_interval: 60
  activity_send_count: 100
  check_permissions_on_boot: true
  check_permissions_on_boot_threads: 4
  websocket_log_count: 150
  sftp:
    enabled: true
    bind_address: 0.0.0.0
    bind_port: ${node.daemonSFTP}
    read_only: false
    key_algorithm: ssh-ed25519
    disable_password_auth: false
    directory_entry_limit: 20000
    directory_entry_send_amount: 500
    limits:
      authentication_password_attempts: 3
      authentication_pubkey_attempts: 20
      authentication_cooldown: 60
    shell:
      enabled: true
      cli:
        name: .wings
    activity:
      log_logins: false
      log_file_reads: false
  crash_detection:
    enabled: true
    detect_clean_exit_as_crash: true
    timeout: 60
  file_history:
    enabled: true
    zstd_level: 19
    anchor_interval: 4
    keep_chains: 2
    file_size_cap: 1048576
    per_file_size_cap: 16777216
    per_file_disk_budget: 5242880
    per_server_disk_budget: 209715200
    maintenance_interval: 3600
  backups:
    write_limit: 0
    read_limit: 0
    compression_level: best_speed
    mounting:
      enabled: true
      path: .backups
    wings:
      create_threads: 4
      restore_threads: 4
      archive_format: tar_gz
    s3:
      create_threads: 4
      part_upload_timeout: 7200
      retry_limit: 10
  transfers:
    download_limit: 0
docker:
  socket: /var/run/docker.sock
  server_name_in_container_name: false
  delete_container_on_stop: true
  network:
    interface: 172.18.0.1
    disable_interface_binding: false
    dns:
    - 1.1.1.1
    - 1.0.0.1
    name: pterodactyl_nw
    ispn: false
    driver: bridge
    mode: pterodactyl_nw
    is_internal: false
    enable_icc: true
    network_mtu: 1500
    interfaces:
      v4:
        subnet: 172.18.0.0/16
        gateway: 172.18.0.1
      v6:
        subnet: fdba:17c8:6c99::/64
        gateway: fdba:17c8:6c99::1011
  domainname: ''
  registries: {}
  tmpfs_size: 100
  container_pid_limit: 5120
  installer_limits:
    timeout: 1800
    memory: 1024
    cpu: 100
  overhead:
    override: false
    default_multiplier: 1.05
    multipliers: {}
  userns_mode: ''
  log_config:
    type: local
    config:
      compress: 'false'
      max-file: '1'
      max-size: 5m
      mode: non-blocking
throttles:
  enabled: true
  lines: 2000
  line_reset_interval: 100
remote: ${appUrl}
remote_headers: {}
remote_query:
  timeout: 30
  boot_servers_per_page: 50
  retry_limit: 10
allowed_mounts: []
allowed_origins:
- ${appUrl}
allow_cors_private_network: false
ignore_panel_config_updates: false
ignore_panel_wings_upgrades: false`;
}
