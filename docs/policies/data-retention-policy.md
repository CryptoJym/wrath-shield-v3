# Data Retention and Disposal Policy (ReWrite LLC) - Provisional

**Owner:** James Brady (Founder) — james@jamesbrady.org  
**Scope:** All data processed by the EA/automation platform, including connected-source content, logs, backups, and derived artifacts.

## 1. Principles
- Collect the minimum data necessary.
- Retain only for the purpose collected or legal obligation.
- Delete or anonymize when no longer needed.

## 2. Default retention periods
- User account data: retained while account is active; deleted within 30 days of deletion request or termination.
- Connected-source data (email, calendar, messages, lifelog, finance): retained while the connection is active; removed within 30 days after revocation or deletion request.
- Task/action artifacts and embeddings: purged within 30 days of source removal.
- System logs (app/exec/audit): 90 days unless required longer for security investigations.
- Backups: 30–60 days rolling; deleted on schedule; restoration deletes follow within the same window.

## 3. Deletion triggers
- User-initiated deletion or revocation.
- Contract termination.
- Expiry of retention timer.
- Incident-driven purge (e.g., suspected compromise).

## 4. Deletion process
- Mark for deletion; revoke access tokens; queue purge jobs.
- Delete from primary stores, search/vector indexes, and backups on next cycle.
- Verify completion; record in deletion log.

## 5. Exceptions
- Legal hold pauses deletion until release.
- Aggregated/fully anonymized data may be retained for analytics.

## 6. Review
- Policy reviewed annually and after material changes to data flows or regulations.
