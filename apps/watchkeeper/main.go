package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"sync"

	_ "github.com/go-sql-driver/mysql"
	"github.com/stripsior/struxa/watchkeeper/internal/workers"
)

func main() {
	rawDSN := os.Getenv("DATABASE_URL")
	if rawDSN == "" {
		log.Fatal("[watchkeeper] DATABASE_URL is not set")
	}

	dsn, err := toDSN(rawDSN)
	if err != nil {
		log.Fatalf("[watchkeeper] invalid DATABASE_URL: %v", err)
	}

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("[watchkeeper] failed to open database: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("[watchkeeper] failed to connect to database: %v", err)
	}

	log.Println("[watchkeeper] starting")

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		workers.RunStatusWorker(db)
	}()
	go func() {
		defer wg.Done()
		workers.RunScheduleWorker(db)
	}()
	wg.Wait()
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
