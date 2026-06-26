package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

type journalEntry struct {
	Idx int    `json:"idx"`
	Tag string `json:"tag"`
}

type journal struct {
	Entries []journalEntry `json:"entries"`
}

func main() {
	rawDSN := os.Getenv("DATABASE_URL")
	if rawDSN == "" {
		log.Fatal("[migrate] DATABASE_URL is not set")
	}

	migrationsDir := os.Getenv("MIGRATIONS_DIR")
	if migrationsDir == "" {
		migrationsDir = "./migrations"
	}

	dsn, err := toDSN(rawDSN)
	if err != nil {
		log.Fatalf("[migrate] invalid DATABASE_URL: %v", err)
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("[migrate] failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("[migrate] failed to connect to database: %v", err)
	}

	if err := ensureMigrationsTable(db); err != nil {
		log.Fatalf("[migrate] failed to create migrations table: %v", err)
	}

	j, err := readJournal(migrationsDir)
	if err != nil {
		log.Fatalf("[migrate] failed to read journal: %v", err)
	}

	log.Println("[migrate] running migrations...")
	for _, entry := range j.Entries {
		if err := applyMigration(db, migrationsDir, entry); err != nil {
			log.Fatalf("[migrate] %q failed: %v", entry.Tag, err)
		}
	}
	log.Println("[migrate] done")
}

func ensureMigrationsTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS __drizzle_migrations (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)`)
	return err
}

func readJournal(dir string) (*journal, error) {
	data, err := os.ReadFile(filepath.Join(dir, "meta", "_journal.json"))
	if err != nil {
		return nil, err
	}
	var j journal
	if err := json.Unmarshal(data, &j); err != nil {
		return nil, err
	}
	sort.Slice(j.Entries, func(i, k int) bool {
		return j.Entries[i].Idx < j.Entries[k].Idx
	})
	return &j, nil
}

func applyMigration(db *sql.DB, dir string, entry journalEntry) error {
	if strings.ContainsAny(entry.Tag, "/\\.") {
		return fmt.Errorf("invalid migration tag: %q", entry.Tag)
	}
	content, err := os.ReadFile(filepath.Join(dir, entry.Tag+".sql"))
	if err != nil {
		return fmt.Errorf("read %q.sql: %w", entry.Tag, err)
	}

	sum := sha256.Sum256(content)
	hash := fmt.Sprintf("%x", sum)

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM __drizzle_migrations WHERE hash=?`, hash).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		log.Printf("[migrate] skip %q (already applied)", entry.Tag)
		return nil
	}

	log.Printf("[migrate] applying %q", entry.Tag)

	for _, stmt := range splitStatements(string(content)) {
		if _, err := db.Exec(stmt); err != nil {
			return fmt.Errorf("exec statement in %q: %w", entry.Tag, err)
		}
	}

	_, err = db.Exec(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
		hash, time.Now().UnixMilli())
	if err != nil {
		return fmt.Errorf("record migration %q: %w", entry.Tag, err)
	}
	return nil
}

// splitStatements splits a Drizzle SQL file on --> statement-breakpoint markers.
func splitStatements(sql string) []string {
	parts := strings.Split(sql, "--> statement-breakpoint")
	var out []string
	for _, p := range parts {
		if s := strings.TrimSpace(p); s != "" {
			out = append(out, s)
		}
	}
	return out
}

// toDSN converts a mysql:// URL to go-sql-driver DSN format and ensures parseTime=true.
func toDSN(raw string) (string, error) {
	if !strings.HasPrefix(raw, "mysql://") {
		if !strings.Contains(raw, "parseTime") {
			if strings.Contains(raw, "?") {
				return raw + "&parseTime=true", nil
			}
			return raw + "?parseTime=true", nil
		}
		return raw, nil
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", err
	}
	pass, _ := u.User.Password()
	params := u.RawQuery
	if !strings.Contains(params, "parseTime") {
		if params != "" {
			params += "&parseTime=true"
		} else {
			params = "parseTime=true"
		}
	}
	return fmt.Sprintf("%s:%s@tcp(%s)%s?%s", u.User.Username(), pass, u.Host, u.Path, params), nil
}
