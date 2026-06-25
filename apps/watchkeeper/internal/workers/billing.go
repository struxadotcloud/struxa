package workers

import (
	"crypto/rand"
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/stripsior/struxa/watchkeeper/internal/crypto"
	"github.com/stripsior/struxa/watchkeeper/internal/wings"
)

const billingInterval = 60 * time.Second

var durationDays = map[string]int{
	"7day":    7,
	"1month":  30,
	"3months": 90,
	"6months": 180,
	"1year":   365,
}

func RunBillingWorker(db *sql.DB) {
	log.Println("[billing] worker started, polling every 60s")
	billingTick(db)
	for range time.Tick(billingInterval) {
		billingTick(db)
	}
}

type expiredSubRow struct {
	id            string
	userId        string
	priceId       string
	currency      string
	currentPeriodEnd time.Time
}

func billingTick(db *sql.DB) {
	rows, err := db.Query(`
		SELECT id, user_id, price_id, currency, current_period_end
		FROM billing_subscriptions
		WHERE status IN ('active','trialing') AND current_period_end <= NOW()`)
	if err != nil {
		log.Printf("[billing] tick query error: %v", err)
		return
	}
	defer rows.Close()

	var subs []expiredSubRow
	for rows.Next() {
		var s expiredSubRow
		if err := rows.Scan(&s.id, &s.userId, &s.priceId, &s.currency, &s.currentPeriodEnd); err != nil {
			log.Printf("[billing] scan error: %v", err)
			continue
		}
		subs = append(subs, s)
	}
	_ = rows.Err()

	for _, s := range subs {
		go func(sub expiredSubRow) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[billing] panic processing sub %s: %v", sub.id, r)
				}
			}()
			processExpiredSubscription(db, sub)
		}(s)
	}
}

func processExpiredSubscription(db *sql.DB, sub expiredSubRow) {
	var priceCents int
	var duration string
	err := db.QueryRow(`SELECT price_cents, duration FROM billing_plan_prices WHERE id=?`, sub.priceId).
		Scan(&priceCents, &duration)
	if err != nil {
		log.Printf("[billing] fetch price for sub %s: %v", sub.id, err)
		suspendSubscription(db, sub)
		return
	}

	days, ok := durationDays[duration]
	if !ok {
		days = 30
	}

	var walletId string
	var balanceCents int
	err = db.QueryRow(`SELECT id, balance_cents FROM billing_wallet WHERE user_id=?`, sub.userId).
		Scan(&walletId, &balanceCents)
	if err != nil {
		log.Printf("[billing] fetch wallet for user %s: %v", sub.userId, err)
		suspendSubscription(db, sub)
		return
	}

	if balanceCents < priceCents {
		suspendSubscription(db, sub)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		log.Printf("[billing] begin tx for sub %s: %v", sub.id, err)
		return
	}

	newPeriodStart := sub.currentPeriodEnd
	newPeriodEnd := sub.currentPeriodEnd.Add(time.Duration(days) * 24 * time.Hour)

	res, err := tx.Exec(`
		UPDATE billing_subscriptions
		SET status='active', current_period_start=?, current_period_end=?
		WHERE id=? AND current_period_end=? AND status IN ('active','trialing')`,
		newPeriodStart, newPeriodEnd, sub.id, sub.currentPeriodEnd)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("[billing] claim sub %s: %v", sub.id, err)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		_ = tx.Rollback()
		return
	}

	res, err = tx.Exec(`
		UPDATE billing_wallet SET balance_cents = balance_cents - ?
		WHERE user_id=? AND balance_cents >= ?`,
		priceCents, sub.userId, priceCents)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("[billing] deduct wallet for sub %s: %v", sub.id, err)
		suspendSubscription(db, sub)
		return
	}
	affected, _ = res.RowsAffected()
	if affected == 0 {
		_ = tx.Rollback()
		suspendSubscription(db, sub)
		return
	}

	balanceAfter := balanceCents - priceCents
	invoiceId := billingUUID()
	invoiceItemId := billingUUID()
	walletTxId := billingUUID()
	transactionId := billingUUID()

	var invoicePrefix string
	_ = db.QueryRow(`SELECT COALESCE(value,'INV-') FROM settings WHERE key='billing_invoice_prefix'`).Scan(&invoicePrefix)
	if invoicePrefix == "" {
		invoicePrefix = "INV-"
	}
	invoiceNumber := fmt.Sprintf("%s%s%s", invoicePrefix, time.Now().Format("20060102"), billingUUID()[:8])

	_, err = tx.Exec(`
		INSERT INTO billing_invoices (id, user_id, subscription_id, invoice_number, status, currency,
			subtotal_cents, discount_cents, total_cents, amount_paid_cents, amount_due_cents, paid_at, created_at, updated_at)
		VALUES (?,?,?,?,'paid',?,?,0,?,?,0,NOW(),NOW(),NOW())`,
		invoiceId, sub.userId, sub.id, invoiceNumber, sub.currency, priceCents, priceCents, priceCents)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("[billing] insert invoice for sub %s: %v", sub.id, err)
		return
	}

	_, err = tx.Exec(`
		INSERT INTO billing_invoice_items (id, invoice_id, description, quantity, unit_amount_cents, total_cents,
			currency, period_start, period_end, created_at, updated_at)
		VALUES (?,?,?,1,?,?,?,?,?,NOW(),NOW())`,
		invoiceItemId, invoiceId, "Subscription renewal", priceCents, priceCents, sub.currency, newPeriodStart, newPeriodEnd)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("[billing] insert invoice item for sub %s: %v", sub.id, err)
		return
	}

	_, err = tx.Exec(`
		INSERT INTO billing_wallet_transactions (id, user_id, invoice_id, amount_cents, balance_after_cents,
			currency, type, description, created_at, updated_at)
		VALUES (?,?,?,?,?,?,'charge','Subscription renewal',NOW(),NOW())`,
		walletTxId, sub.userId, invoiceId, -priceCents, balanceAfter, sub.currency)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("[billing] insert wallet tx for sub %s: %v", sub.id, err)
		return
	}

	_, err = tx.Exec(`
		INSERT INTO billing_transactions (id, user_id, invoice_id, type, status, amount_cents, currency,
			description, created_at, updated_at)
		VALUES (?,?,?,'payment','succeeded',?,?,'Subscription renewal',NOW(),NOW())`,
		transactionId, sub.userId, invoiceId, priceCents, sub.currency)
	if err != nil {
		_ = tx.Rollback()
		log.Printf("[billing] insert transaction for sub %s: %v", sub.id, err)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("[billing] commit renewal for sub %s: %v", sub.id, err)
		return
	}

	log.Printf("[billing] renewed subscription %s for user %s (+%d days)", sub.id, sub.userId, days)
}

func suspendSubscription(db *sql.DB, sub expiredSubRow) {
	res, err := db.Exec(`
		UPDATE billing_subscriptions SET status='past_due'
		WHERE id=? AND status IN ('active','trialing')`, sub.id)
	if err != nil {
		log.Printf("[billing] suspend sub %s: %v", sub.id, err)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return
	}

	rows, err := db.Query(`
		SELECT s.id, s.uuid, n.fqdn, n.scheme, n.daemon_listen, n.token
		FROM servers s JOIN nodes n ON s.node_id=n.id
		WHERE s.subscription_id=? AND s.suspended=0`, sub.id)
	if err != nil {
		log.Printf("[billing] fetch servers for sub %s: %v", sub.id, err)
		return
	}
	defer rows.Close()

	type srvRow struct {
		id, uuid, fqdn, scheme, token string
		listen                         int
	}
	var srvs []srvRow
	for rows.Next() {
		var r srvRow
		if err := rows.Scan(&r.id, &r.uuid, &r.fqdn, &r.scheme, &r.listen, &r.token); err != nil {
			log.Printf("[billing] scan server row: %v", err)
			continue
		}
		srvs = append(srvs, r)
	}

	for _, srv := range srvs {
		if _, err := db.Exec(`UPDATE servers SET suspended=1 WHERE id=?`, srv.id); err != nil {
			log.Printf("[billing] suspend server %s: %v", srv.uuid, err)
			continue
		}
		tok, err := crypto.DecryptToken(srv.token)
		if err != nil {
			log.Printf("[billing] failed to decrypt token for server %s: %v", srv.uuid, err)
			continue
		}
		client := wings.New(srv.scheme, srv.fqdn, srv.listen, tok)
		if err := client.SendPowerAction(srv.uuid, "kill"); err != nil {
			log.Printf("[billing] kill server %s: %v", srv.uuid, err)
		}
	}

	log.Printf("[billing] subscription %s past_due — %d server(s) suspended", sub.id, len(srvs))
}

func billingUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
