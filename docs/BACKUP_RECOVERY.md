# VenxPOS — Backup & Recovery

**Version**: 1.0.0
**Date**: 2026-06-19
**Database**: Supabase PostgreSQL 17

---

## 1. Backup Strategy Overview

VenxPOS relies on three layers of backup:

| Layer | Mechanism | RPO | RTO | Owner |
|-------|-----------|-----|-----|-------|
| **Automatic** | Supabase PITR (Point-in-Time Recovery) | ≤ 5 minutes | ≤ 4 hours | Supabase (managed) |
| **Manual Daily** | pg_dump to cloud storage | ≤ 24 hours | ≤ 4 hours | DevOps |
| **Critical Export** | CSV export of key tables | ≤ 24 hours | ≤ 2 hours | DevOps |

---

## 2. Supabase Automatic Backup (PITR)

### Configuration

**Requirement:** Supabase Pro plan or higher.

**What it covers:**
- Continuous WAL (Write-Ahead Log) archiving
- Full database snapshot daily
- Point-in-time recovery to any second within the retention window

### Retention

| Plan | PITR Retention |
|------|---------------|
| Pro | 7 days |
| Team | 14 days |
| Enterprise | 28 days (custom) |

### Verification

1. Go to Supabase Dashboard → Database → Backups
2. Verify that PITR is **Active**
3. Check the "Earliest Restore Point" to confirm retention
4. Note the latest backup timestamp

### Restore Procedure (PITR)

```
1. Supabase Dashboard → Database → Backups
2. Click "Restore"
3. Select restore point (date/time)
4. Choose:
   a. Restore to NEW project (recommended — safer, requires re-pointing DNS)
   b. Restore to current project (overwrites existing data)
5. Wait for restore to complete (typically 30–60 minutes)
6. Verify: login, tenant data, subscription status, payment records
7. If restored to new project:
   a. Update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel
   b. Update Edge Function environment variables
   c. Re-deploy Edge Functions to new project
   d. Update Wompi webhook URL
```

---

## 3. Manual Backup (pg_dump)

### Automated Daily Backup Script

Save as `scripts/backup.sh`:

```bash
#!/bin/bash
# VenxPOS Daily Backup Script
# Usage: ./scripts/backup.sh
# Requires: pg_dump, gzip, AWS CLI (or rclone)

set -euo pipefail

# Configuration
DB_URL="${SUPABASE_DB_URL}"                    # From Supabase Dashboard → Database → Connection String
PROJECT_NAME="venxpos"
BACKUP_DIR="/tmp/venxpos-backups"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="${BACKUP_DIR}/${PROJECT_NAME}_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Dump database
echo "[$(date)] Starting backup..."
pg_dump "${DB_URL}" \
  --format=plain \
  --no-owner \
  --no-acl \
  --compress=0 \
  | gzip > "${BACKUP_FILE}"

# Verify backup
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "[$(date)] ERROR: Backup file is empty!"
  exit 1
fi

echo "[$(date)] Backup complete: ${BACKUP_FILE}"
echo "[$(date)] Backup size: $(du -h ${BACKUP_FILE} | cut -f1)"

# Upload to S3 (or equivalent cloud storage)
# Uncomment and configure:
# aws s3 cp "${BACKUP_FILE}" "s3://venxpos-backups/${TIMESTAMP}.sql.gz"

# Cleanup old backups (keep 30 days)
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +30 -delete

echo "[$(date)] Backup process complete."
```

### Scheduling

| Environment | Method | Frequency |
|-------------|--------|-----------|
| Development | Manual | On demand |
| Staging | GitHub Actions cron | Daily at 02:00 UTC |
| Production | GitHub Actions cron / external server | Daily at 02:00 UTC |

**GitHub Actions example (`.github/workflows/backup.yml`):**

```yaml
name: Daily Database Backup
on:
  schedule:
    - cron: '0 2 * * *'  # 02:00 UTC daily
  workflow_dispatch:      # Manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client
      - name: Run backup
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: ./scripts/backup.sh
```

---

## 4. Critical Data Export (CSV)

For secondary backup of the most critical tables:

```sql
-- Export critical SaaS tables as CSV

\COPY (SELECT * FROM tenants ORDER BY created_at DESC) TO '/backups/tenants.csv' CSV HEADER;
\COPY (SELECT * FROM subscriptions ORDER BY created_at DESC) TO '/backups/subscriptions.csv' CSV HEADER;
\COPY (SELECT * FROM payments ORDER BY created_at DESC) TO '/backups/payments.csv' CSV HEADER;
\COPY (SELECT * FROM subscription_events ORDER BY created_at DESC) TO '/backups/subscription_events.csv' CSV HEADER;
\COPY (SELECT * FROM branch_accounts ORDER BY created_at DESC) TO '/backups/branch_accounts.csv' CSV HEADER;
\COPY (SELECT * FROM superadmins) TO '/backups/superadmins.csv' CSV HEADER;
\COPY (SELECT * FROM plans) TO '/backups/plans.csv' CSV HEADER;

-- Critical POS tables
\COPY (SELECT * FROM empresas) TO '/backups/empresas.csv' CSV HEADER;
\COPY (SELECT * FROM sucursales) TO '/backups/sucursales.csv' CSV HEADER;
\COPY (SELECT * FROM ventas WHERE created_at > NOW() - INTERVAL '90 days') TO '/backups/ventas_recent.csv' CSV HEADER;
\COPY (SELECT * FROM productos WHERE activo = true) TO '/backups/productos_active.csv' CSV HEADER;
```

### Automation

Wrap in a script and schedule weekly via cron:

```bash
#!/bin/bash
# Weekly critical data CSV export

DB_URL="${SUPABASE_DB_URL}"
BACKUP_DIR="/tmp/venxpos-csv-backups/$(date -u +%Y-%m-%d)"
mkdir -p "${BACKUP_DIR}"

for table in tenants subscriptions payments subscription_events branch_accounts superadmins plans empresas sucursales; do
  echo "Exporting ${table}..."
  psql "${DB_URL}" -c "\COPY (SELECT * FROM ${table}) TO '${BACKUP_DIR}/${table}.csv' CSV HEADER"
done

echo "CSV export complete: ${BACKUP_DIR}"
```

---

## 5. Backup Frequency & Retention Summary

| Backup Type | Frequency | Retention | Storage Location |
|-------------|-----------|-----------|-----------------|
| Supabase PITR | Continuous | 7–28 days (plan dependent) | Supabase managed |
| pg_dump (full) | Daily | 30 days | S3 / cloud storage |
| pg_dump (monthly archive) | Monthly | 12 months | S3 Glacier / cold storage |
| CSV export | Weekly | 90 days | S3 / cloud storage |

---

## 6. Recovery Procedures

### 6.1 Full Database Restore

**Scenario:** Complete database corruption or data loss.

```
1. DECLARE INCIDENT (see incident response plan in PRODUCTION_READINESS.md)
2. ASSESS: Is PITR available? If yes, proceed with PITR restore.
   If no, proceed with pg_dump restore.
3. NOTIFY: Post in #incidents Slack channel
4. EXECUTE RESTORE:
   a. For PITR: Supabase Dashboard → Database → Backups → Restore
   b. For pg_dump:
      psql "${SUPABASE_DB_URL}" < /path/to/backup.sql
5. VERIFY:
   - Can users log in?
   - Are tenant records intact?
   - Are subscription states correct?
   - Are payment records present?
   - Are POS records intact?
6. COMMUNICATE: Update stakeholders on recovery status
7. POST-MORTEM: Document incident within 48 hours
```

### 6.2 Point-in-Time Recovery

**Scenario:** Accidental data modification or deletion at a known time.

```
1. Identify the incident timestamp (e.g., "DELETE FROM payments without WHERE at 14:32 UTC")
2. Supabase Dashboard → Database → Backups
3. Select "Restore to point in time"
4. Choose timestamp BEFORE the incident (e.g., 14:31 UTC)
5. Restore to new project
6. Verify data integrity in new project
7. Point application to new project
```

### 6.3 Table-Level Restore

**Scenario:** A single table needs recovery without full database restore.

```
1. Restore full database via PITR to a NEW project
2. Export the affected table from the restored project:
   pg_dump -t tenants restored_db > tenants_data.sql
3. Import to production:
   psql production_db < tenants_data.sql
4. Verify and clean up the temporary project
```

### 6.4 Single Tenant Restore

**Scenario:** One tenant requests data recovery.

```
1. Restore full database via PITR to a NEW project (temporary)
2. Export tenant's data:
   \COPY (SELECT * FROM tenants WHERE id = 'tenant-uuid') TO 'tenant.csv' CSV HEADER;
   \COPY (SELECT * FROM subscriptions WHERE tenant_id = 'tenant-uuid') TO 'subscriptions.csv' CSV HEADER;
   \COPY (SELECT * FROM payments WHERE tenant_id = 'tenant-uuid') TO 'payments.csv' CSV HEADER;
   -- etc.
3. Review exported data
4. Provide to tenant or re-import as needed
```

---

## 7. Backup Verification

### Weekly Automated Test

```bash
#!/bin/bash
# Test restore from latest backup to a staging Supabase project

STAGING_DB_URL="${SUPABASE_STAGING_DB_URL}"
LATEST_BACKUP=$(ls -t /tmp/venxpos-backups/*.sql.gz | head -1)

echo "Testing restore of: ${LATEST_BACKUP}"
gunzip -c "${LATEST_BACKUP}" | psql "${STAGING_DB_URL}"

# Verify core data
psql "${STAGING_DB_URL}" -c "
  SELECT 'tenants', COUNT(*) FROM tenants
  UNION ALL
  SELECT 'subscriptions', COUNT(*) FROM subscriptions
  UNION ALL
  SELECT 'payments', COUNT(*) FROM payments
  UNION ALL
  SELECT 'plans', COUNT(*) FROM plans;
"

echo "Verification complete."
```

### Verification Checklist

- [ ] Backup file is not empty and not corrupted
- [ ] Backup can be restored to staging successfully
- [ ] Tenant records are intact (count matches production)
- [ ] Subscription states are preserved
- [ ] Payment records are complete
- [ ] RLS policies are preserved (verify with test queries)
- [ ] Functions and triggers exist post-restore
- [ ] Indexes exist post-restore
- [ ] Users can authenticate post-restore

---

## 8. Emergency Contacts and Escalation

### Internal Contacts

| Role | Name | Contact | Escalation Time |
|------|------|---------|-----------------|
| CTO / Technical Lead | TBD | [phone] / [email] | Immediate |
| DevOps Engineer | TBD | [phone] / [email] | 15 minutes |
| Backend Engineer | TBD | [phone] / [email] | 30 minutes |
| Engineering Manager | TBD | [phone] / [email] | 60 minutes |

### External Contacts

| Service | Support Method | SLA |
|---------|---------------|-----|
| **Supabase** | Dashboard → Support, [email] | Pro: 8h response |
| **Wompi** | [https://wompi.co/ayuda](https://wompi.co/ayuda) | Business hours |
| **Resend** | [https://resend.com/help](https://resend.com/help) | Varies |
| **Vercel** | Dashboard → Help | Pro: 8h response |
| **Domain Registrar** | TBD | Varies |

### Escalation Matrix

```
Incident Detected
      │
      ▼
  Severity 1? ──YES──→ CTO (immediate) + DevOps (15 min)
      │
      NO
      │
      ▼
  Severity 2? ──YES──→ DevOps (1 hour)
      │
      NO
      │
      ▼
  File ticket → Backlog
```

---

## 9. Disaster Recovery Runbook

### Preparation

- [ ] Printed copy of critical credentials stored in secure location
- [ ] Backup scripts tested and verified
- [ ] Restoration tested in last 30 days
- [ ] All team members have access to Supabase dashboard
- [ ] DNS management access available to at least 2 people

### Disaster Scenarios

| Scenario | Detection | Action |
|----------|-----------|--------|
| **Supabase region outage** | Uptime monitor alert | Wait for Supabase recovery; if > 2h, consider cross-region restore |
| **Data corruption** | Application errors, user reports | PITR restore to point before corruption |
| **Accidental deletion** | User report or audit log | PITR restore to new project, merge data |
| **Ransomware / malicious attack** | Security alert | Rotate all secrets, PITR restore, security audit |
| **Payment data loss** | Reconciliation failure | Restore from backup, cross-check with Wompi dashboard |

### Restoration Time Estimates

| Recovery Type | Estimated Time | Notes |
|---------------|---------------|-------|
| PITR restore (new project) | 30–60 minutes | Depends on database size |
| pg_dump restore | 15–45 minutes | Depends on file size |
| Re-pointing DNS/application | 15–30 minutes | If restoring to new project |
| Full verification | 30–60 minutes | Automated tests + manual checks |
| **Total RTO (realistic)** | **2–4 hours** | |

---

*End of Backup & Recovery Document*
