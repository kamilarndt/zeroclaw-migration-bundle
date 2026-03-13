//! SQLite database schema for quota tracking

use rusqlite::{Connection, Result};
use rusqlite::params;

/// Create/update the quota tracking database schema
pub fn init_schema(conn: &Connection) -> Result<()> {
    // Create quota_usage table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS quota_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE,
            provider TEXT NOT NULL,
            tokens_used INTEGER NOT NULL DEFAULT 0,
            requests_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Create request_log table for rate limiting
    conn.execute(
        "CREATE TABLE IF NOT EXISTS request_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            provider TEXT NOT NULL,
            model TEXT,
            tokens INTEGER
        )",
        [],
    )?;

    // Create indexes
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_quota_usage_date_provider
        ON quota_usage(date, provider)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_request_log_timestamp
        ON request_log(timestamp)",
        [],
    )?;

    Ok(())
}

/// Get or create today's quota record for a provider
pub fn get_or_create_daily_quota(
    conn: &Connection,
    date: &str,
    provider: &str,
) -> Result<(i64, i64)> {
    conn.execute(
        "INSERT INTO quota_usage (date, provider, tokens_used, requests_count)
        VALUES (?, ?, 0, 0)
        ON CONFLICT(date, provider) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
        params![date, provider],
    )?;

    conn.query_row(
        "SELECT tokens_used, requests_count FROM quota_usage WHERE date = ? AND provider = ?",
        params![date, provider],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
}

/// Update quota usage after a request
pub fn update_quota_usage(
    conn: &Connection,
    date: &str,
    provider: &str,
    tokens: i64,
) -> Result<()> {
    conn.execute(
        "UPDATE quota_usage
        SET tokens_used = tokens_used + ?,
            requests_count = requests_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE date = ? AND provider = ?",
        params![tokens, date, provider],
    )?;
    Ok(())
}

/// Log a request for rate limiting
pub fn log_request(
    conn: &Connection,
    provider: &str,
    model: Option<&str>,
    tokens: i64,
) -> Result<()> {
    conn.execute(
        "INSERT INTO request_log (provider, model, tokens)
        VALUES (?, ?, ?)",
        params![provider, model, tokens],
    )?;
    Ok(())
}

/// Clean old log entries (older than 30 days)
pub fn clean_old_logs(conn: &Connection) -> Result<u64> {
    let result = conn.execute(
        "DELETE FROM request_log
        WHERE timestamp < datetime('now', '-30 days')",
        [],
    )?;
    Ok(result as u64)
}
