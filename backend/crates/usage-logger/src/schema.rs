//! SQLite schema for metrics logging

use rusqlite::Connection;
use super::metrics::RequestMetrics;

/// Initialize metrics database schema
pub fn init_schema(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            provider TEXT NOT NULL,
            model TEXT NOT NULL,
            task_hint TEXT NOT NULL,
            response_time_ms INTEGER NOT NULL,
            time_to_first_token_ms INTEGER,
            prompt_tokens INTEGER NOT NULL,
            completion_tokens INTEGER NOT NULL,
            total_tokens INTEGER NOT NULL,
            estimated_cost_usd REAL NOT NULL,
            success BOOLEAN NOT NULL,
            error_type TEXT,
            user_rating INTEGER
        )",
        [],
    )?;

    // Indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp DESC)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_model_task ON metrics(model, task_hint)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_provider ON metrics(provider)", [])?;

    Ok(())
}

/// Insert a metrics record
pub fn insert_metrics(conn: &Connection, metrics: &RequestMetrics) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO metrics (id, timestamp, provider, model, task_hint,
                         response_time_ms, time_to_first_token_ms,
                         prompt_tokens, completion_tokens, total_tokens,
                         estimated_cost_usd, success, error_type, user_rating)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        (
            &metrics.id,
            &metrics.timestamp.format("%Y-%m-%dT%H:%M:%S%.f").to_string(),
            &metrics.provider,
            &metrics.model,
            &metrics.task_hint,
            metrics.response_time_ms as i64,
            metrics.time_to_first_token_ms.map(|v| v as i64),
            metrics.prompt_tokens as i64,
            metrics.completion_tokens as i64,
            metrics.total_tokens as i64,
            metrics.estimated_cost_usd,
            metrics.success,
            &metrics.error_type,
            metrics.user_rating.map(|v| v as i64),
        ),
    )?;
    Ok(())
}
