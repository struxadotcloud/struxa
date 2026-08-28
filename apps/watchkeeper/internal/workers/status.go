package workers

import (
	"database/sql"
	"log"
	"sync"
	"time"

	"github.com/stripsior/struxa/watchkeeper/internal/crypto"
	"github.com/stripsior/struxa/watchkeeper/internal/wings"
)

const statusInterval = 30 * time.Second

func RunStatusWorker(db *sql.DB) {
	log.Println("[status] worker started, polling every 30s")
	statusTick(db)
	for range time.Tick(statusInterval) {
		statusTick(db)
	}
}

func statusTick(db *sql.DB) {
	nodes, err := fetchNodes(db)
	if err != nil {
		log.Printf("[status] failed to fetch nodes: %v", err)
		return
	}
	var wg sync.WaitGroup
	for _, n := range nodes {
		wg.Add(1)
		go func(n nodeRow) {
			defer wg.Done()
			processNode(db, n)
		}(n)
	}
	wg.Wait()
}

type nodeRow struct {
	id           string
	fqdn         string
	scheme       string
	daemonListen int
	token        string
}

func fetchNodes(db *sql.DB) ([]nodeRow, error) {
	rows, err := db.Query(`SELECT id, fqdn, scheme, daemon_listen, token FROM nodes`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []nodeRow
	for rows.Next() {
		var n nodeRow
		if err := rows.Scan(&n.id, &n.fqdn, &n.scheme, &n.daemonListen, &n.token); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

type serverRow struct {
	id         string
	uuid       string
	status     string
	powerState sql.NullString
	name       string
	userId     sql.NullString
}

func fetchServers(db *sql.DB, nodeID string) ([]serverRow, error) {
	rows, err := db.Query(`SELECT id, uuid, status, power_state, name, user_id FROM servers WHERE node_id=?`, nodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []serverRow
	for rows.Next() {
		var s serverRow
		if err := rows.Scan(&s.id, &s.uuid, &s.status, &s.powerState, &s.name, &s.userId); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func processNode(db *sql.DB, node nodeRow) {
	token, err := crypto.DecryptToken(node.token)
	if err != nil {
		log.Printf("[status] failed to decrypt token for node %s: %v", node.id, err)
		return
	}
	client := wings.New(node.scheme, node.fqdn, node.daemonListen, token)
	utilization, err := client.GetUtilization()
	if err != nil {
		log.Printf("[status] could not reach node %s (%s): %v", node.id, node.fqdn, err)
		return
	}
	servers, err := fetchServers(db, node.id)
	if err != nil {
		log.Printf("[status] failed to fetch servers for node %s: %v", node.id, err)
		return
	}
	for _, srv := range servers {
		if srv.status != "" {
			continue // skip non-installed servers (installing, suspended, etc.)
		}
		cur := "offline"
		if srv.powerState.Valid {
			cur = srv.powerState.String
		}
		state := "offline"
		if u, ok := utilization[srv.uuid]; ok {
			state = u.State
		}
		if state == cur {
			continue
		}
		if _, err := db.Exec(`UPDATE servers SET power_state=? WHERE id=?`, state, srv.id); err != nil {
			log.Printf("[status] failed to update server %s: %v", srv.uuid, err)
			continue
		}
		go notifyServerStatus(db, srv.id, srv.name, srv.uuid, srv.userId.String, state)
	}
}
