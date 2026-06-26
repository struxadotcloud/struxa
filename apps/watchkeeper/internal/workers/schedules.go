package workers

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/stripsior/struxa/watchkeeper/internal/wings"
)

const scheduleInterval = 15 * time.Second

var cronParser = cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)

func RunScheduleWorker(db *sql.DB) {
	log.Println("[schedules] worker started, polling every 15s")
	scheduleTick(db)
	for range time.Tick(scheduleInterval) {
		scheduleTick(db)
	}
}

func scheduleTick(db *sql.DB) {
	due, err := fetchDueSchedules(db)
	if err != nil {
		log.Printf("[schedules] tick error: %v", err)
		return
	}
	for _, s := range due {
		go func(sched scheduleRow) {
			if err := runSchedule(db, sched); err != nil {
				log.Printf("[schedules] schedule %q failed: %v", sched.name, err)
			}
		}(s)
	}
}

type scheduleRow struct {
	id             string
	name           string
	serverID       string
	cronSecond     string
	cronMinute     string
	cronHour       string
	cronDayOfWeek  string
	cronDayOfMonth string
}

type taskRow struct {
	id             string
	action         string
	payload        string
	timeOffset     int
	continueOnFail bool
}

func fetchDueSchedules(db *sql.DB) ([]scheduleRow, error) {
	rows, err := db.Query(`
		SELECT id, name, server_id, cron_second, cron_minute, cron_hour, cron_day_of_week, cron_day_of_month
		FROM schedules
		WHERE is_active=1 AND is_processing=0 AND next_run_at IS NOT NULL AND next_run_at<=NOW()`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []scheduleRow
	for rows.Next() {
		var s scheduleRow
		if err := rows.Scan(&s.id, &s.name, &s.serverID,
			&s.cronSecond, &s.cronMinute, &s.cronHour, &s.cronDayOfWeek, &s.cronDayOfMonth); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func fetchTasks(db *sql.DB, scheduleID string) ([]taskRow, error) {
	rows, err := db.Query(`
		SELECT id, action, payload, time_offset, continue_on_failure
		FROM schedule_tasks WHERE schedule_id=? ORDER BY sequence_id ASC`, scheduleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []taskRow
	for rows.Next() {
		var t taskRow
		if err := rows.Scan(&t.id, &t.action, &t.payload, &t.timeOffset, &t.continueOnFail); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func runSchedule(db *sql.DB, sched scheduleRow) error {
	var serverUUID, nodeFQDN, nodeScheme, nodeToken string
	var nodeListen int
	err := db.QueryRow(`
		SELECT srv.uuid, n.fqdn, n.scheme, n.daemon_listen, n.token
		FROM servers srv JOIN nodes n ON srv.node_id=n.id WHERE srv.id=?`, sched.serverID).
		Scan(&serverUUID, &nodeFQDN, &nodeScheme, &nodeListen, &nodeToken)
	if err != nil {
		return fmt.Errorf("fetch server/node: %w", err)
	}

	tasks, err := fetchTasks(db, sched.id)
	if err != nil {
		return fmt.Errorf("fetch tasks: %w", err)
	}

	if _, err := db.Exec(`UPDATE schedules SET is_processing=1 WHERE id=?`, sched.id); err != nil {
		return fmt.Errorf("mark processing: %w", err)
	}

	log.Printf("[schedules] running schedule %q for server %q", sched.name, serverUUID)

	client := wings.New(nodeScheme, nodeFQDN, nodeListen, nodeToken)
	taskErr := executeTasks(client, serverUUID, tasks)

	nextRun := computeNextRun(sched)
	if _, err := db.Exec(
		`UPDATE schedules SET is_processing=0, last_run_at=?, next_run_at=? WHERE id=?`,
		time.Now(), nextRun, sched.id,
	); err != nil {
		log.Printf("[schedules] failed to finalise schedule %s: %v", sched.id, err)
	}
	return taskErr
}

func executeTasks(client *wings.Client, serverUUID string, tasks []taskRow) error {
	for _, t := range tasks {
		if t.timeOffset > 0 {
			time.Sleep(time.Duration(t.timeOffset) * time.Second)
		}
		if err := executeTask(client, serverUUID, t); err != nil {
			log.Printf("[schedules] task %q (%q) failed: %v", t.id, t.action, err)
			if !t.continueOnFail {
				return err
			}
		}
	}
	return nil
}

func executeTask(client *wings.Client, serverUUID string, t taskRow) error {
	switch t.action {
	case "power":
		return client.SendPowerAction(serverUUID, t.payload)
	case "command":
		return client.SendCommands(serverUUID, []string{t.payload})
	case "backup":
		return client.CreateBackup(serverUUID, wings.BackupPayload{
			UUID:    newUUID(),
			Adapter: "wings",
		})
	default:
		log.Printf("[schedules] unknown task action: %s", t.action)
		return nil
	}
}

func computeNextRun(sched scheduleRow) *time.Time {
	// 6-field cron: second minute hour dayOfMonth * dayOfWeek
	expr := fmt.Sprintf("%s %s %s %s * %s",
		sched.cronSecond, sched.cronMinute, sched.cronHour, sched.cronDayOfMonth, sched.cronDayOfWeek)
	s, err := cronParser.Parse(expr)
	if err != nil {
		return nil
	}
	next := s.Next(time.Now())
	if next.IsZero() {
		return nil
	}
	return &next
}

func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
