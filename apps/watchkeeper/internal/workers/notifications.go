package workers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/stripsior/struxa/watchkeeper/internal/crypto"
)

const notifyHTTPTimeout = 8 * time.Second

type notifConfig struct {
	appName           string
	appURL            string
	discordEnabled    bool
	discordURL        string
	telegramEnabled   bool
	telegramToken     string
	telegramChatID    string
	userConfigEnabled bool
}

func loadNotifConfig(db *sql.DB) (notifConfig, error) {
	rows, err := db.Query("SELECT `key`, `value` FROM settings")
	if err != nil {
		return notifConfig{}, err
	}
	defer rows.Close()
	s := map[string]string{}
	for rows.Next() {
		var k, v sql.NullString
		if err := rows.Scan(&k, &v); err != nil {
			return notifConfig{}, err
		}
		s[k.String] = v.String
	}
	if err := rows.Err(); err != nil {
		return notifConfig{}, err
	}
	cfg := notifConfig{
		appName:           s["app_name"],
		appURL:            os.Getenv("APP_URL"),
		discordEnabled:    s["notifications_discord_enabled"] == "true",
		telegramEnabled:   s["notifications_telegram_enabled"] == "true",
		userConfigEnabled: s["notifications_user_config_enabled"] == "true",
	}
	if cfg.appName == "" {
		cfg.appName = "Struxa"
	}
	if cfg.appURL == "" {
		cfg.appURL = s["app_url"]
	}
	if v := s["notifications_discord_webhook_url"]; v != "" {
		if plain, err := crypto.DecryptToken(v); err == nil {
			cfg.discordURL = plain
		}
	}
	if v := s["notifications_telegram_bot_token"]; v != "" {
		if plain, err := crypto.DecryptToken(v); err == nil {
			cfg.telegramToken = plain
		}
	}
	cfg.telegramChatID = s["notifications_telegram_chat_id"]
	return cfg, nil
}

type ownerNotifConfig struct {
	discordURL     string
	telegramToken  string
	telegramChatID string
}

func loadOwnerConfig(db *sql.DB, userID string) (ownerNotifConfig, error) {
	var webhook, token, chatID sql.NullString
	err := db.QueryRow(
		`SELECT notification_discord_webhook, notification_telegram_token, notification_telegram_chat_id FROM user WHERE id=?`,
		userID,
	).Scan(&webhook, &token, &chatID)
	if err != nil {
		return ownerNotifConfig{}, err
	}
	var c ownerNotifConfig
	if webhook.Valid && webhook.String != "" {
		if plain, err := crypto.DecryptToken(webhook.String); err == nil {
			c.discordURL = plain
		}
	}
	if token.Valid && token.String != "" {
		if plain, err := crypto.DecryptToken(token.String); err == nil {
			c.telegramToken = plain
		}
	}
	if chatID.Valid {
		c.telegramChatID = chatID.String
	}
	return c, nil
}

type statusNotifyJob struct {
	serverID   string
	serverName string
	uuid       string
	ownerID    string
	state      string
}

var (
	statusNotifyMu   sync.Mutex
	statusNotifyJobs = map[string]statusNotifyJob{}
	statusNotifyWake = make(chan struct{}, 1)
)

func enqueueStatusNotify(job statusNotifyJob) {
	statusNotifyMu.Lock()
	statusNotifyJobs[job.serverID] = job
	statusNotifyMu.Unlock()
	select {
	case statusNotifyWake <- struct{}{}:
	default:
	}
}

func runStatusNotifyDispatcher(db *sql.DB) {
	for range statusNotifyWake {
		for {
			statusNotifyMu.Lock()
			var job statusNotifyJob
			ok := false
			for k, v := range statusNotifyJobs {
				job = v
				delete(statusNotifyJobs, k)
				ok = true
				break
			}
			statusNotifyMu.Unlock()
			if !ok {
				break
			}
			notifyServerStatus(db, job.serverID, job.serverName, job.uuid, job.ownerID, job.state)
		}
	}
}

func notifyServerStatus(db *sql.DB, serverID, serverName, uuid, ownerID, state string) {
	if state != "running" && state != "offline" {
		return
	}
	cfg, err := loadNotifConfig(db)
	if err != nil {
		log.Printf("[status] failed to load notification config: %v", err)
		return
	}
	label := "online"
	title := "Server online"
	if state == "offline" {
		label = "offline"
		title = "Server offline"
	}
	short := uuid
	if len(short) > 8 {
		short = short[:8]
	}
	msg := fmt.Sprintf("[%s] Server %q (%s) is now %s", cfg.appName, serverName, short, label)
	n := notifMessage{
		title:       title,
		subtitle:    fmt.Sprintf("%s is now %s.", serverName, label),
		detail:      fmt.Sprintf("**%s** · %s", serverName, short),
		buttonLabel: "View server",
	}
	if cfg.appURL != "" {
		n.buttonURL = cfg.appURL + "/servers/" + uuid
	}

	if cfg.discordEnabled && cfg.discordURL != "" {
		if err := postDiscord(cfg.discordURL, n); err != nil {
			log.Printf("[status] discord notify failed for server %s: %v", serverID, err)
		}
	}
	if cfg.telegramEnabled && cfg.telegramToken != "" && cfg.telegramChatID != "" {
		if err := postTelegram(cfg.telegramToken, cfg.telegramChatID, msg); err != nil {
			log.Printf("[status] telegram notify failed for server %s: %v", serverID, err)
		}
	}

	if ownerID == "" || !cfg.userConfigEnabled {
		return
	}
	oc, err := loadOwnerConfig(db, ownerID)
	if err != nil {
		log.Printf("[status] failed to load owner notification config for %s: %v", ownerID, err)
		return
	}
	if oc.discordURL != "" {
		if err := postDiscord(oc.discordURL, n); err != nil {
			log.Printf("[status] discord notify failed for owner %s: %v", ownerID, err)
		}
	}
	if oc.telegramToken != "" && oc.telegramChatID != "" {
		if err := postTelegram(oc.telegramToken, oc.telegramChatID, msg); err != nil {
			log.Printf("[status] telegram notify failed for owner %s: %v", ownerID, err)
		}
	}
}

type notifMessage struct {
	title       string
	subtitle    string
	detail      string
	buttonLabel string
	buttonURL   string
}

func postDiscord(url string, v notifMessage) error {
	header := fmt.Sprintf("### ✦ %s\n%s", v.title, v.subtitle)
	inner := []any{}
	if v.buttonURL != "" {
		inner = append(inner,
			map[string]any{
				"type": 9,
				"components": []any{
					map[string]any{"type": 10, "content": header},
				},
				"accessory": map[string]any{"type": 2, "style": 5, "label": v.buttonLabel, "url": v.buttonURL},
			},
			map[string]any{"type": 14, "divider": true, "spacing": 1},
		)
	} else {
		inner = append(inner, map[string]any{"type": 10, "content": header})
	}
	inner = append(inner,
		map[string]any{"type": 10, "content": v.detail},
		map[string]any{"type": 10, "content": fmt.Sprintf("-# <t:%d:R>", time.Now().Unix())},
	)
	payload := map[string]any{
		"flags":            32768,
		"allowed_mentions": map[string]any{"parse": []any{}},
		"components": []any{
			map[string]any{"type": 17, "accent_color": nil, "components": inner},
		},
	}
	data, _ := json.Marshal(payload)
	return httpPostJSON(withComponentsParam(url), data)
}

func withComponentsParam(url string) string {
	if strings.Contains(url, "?") {
		return url + "&with_components=true"
	}
	return url + "?with_components=true"
}

func postTelegram(token, chatID, text string) error {
	body, _ := json.Marshal(map[string]string{"chat_id": chatID, "text": text})
	return httpPostJSON(fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token), body)
}

func httpPostJSON(target string, body []byte) error {
	client := &http.Client{Timeout: notifyHTTPTimeout}
	resp, err := client.Post(target, "application/json", bytes.NewReader(body))
	if err != nil {
		var urlErr *url.Error
		if errors.As(err, &urlErr) {
			return fmt.Errorf("post request failed: %w", urlErr.Err)
		}
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("http %d", resp.StatusCode)
	}
	return nil
}
