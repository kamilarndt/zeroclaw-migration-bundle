//! Benchmark analysis and routing optimization

use rusqlite::Connection;

/// Get best model for a specific task type
pub fn get_best_model_for_task(
    conn: &Connection,
    task_hint: &str,
    min_samples: i64,
) -> Option<String> {
    let result: Option<String> = conn.query_row(
        "SELECT model FROM metrics
         WHERE task_hint = ?1
           AND timestamp > datetime('now', '-7 days')
         GROUP BY model
         HAVING COUNT(*) >= ?2
         ORDER BY AVG(response_time_ms) * 0.4 + AVG(estimated_cost_usd) * 1000 * 0.4 ASC
         LIMIT 1",
        [task_hint, min_samples],
        |row| row.get(0),
    ).ok()?;
    result
}

/// Analyze performance and suggest routing changes
pub fn analyze_routing(conn: &Connection) -> Result<Vec<RoutingSuggestion>, Box<dyn std::error::Error>> {
    let mut suggestions = Vec::new();

    let mut stmt = conn.prepare(
        "SELECT task_hint, COUNT(*) as count
         FROM metrics
         WHERE timestamp > datetime('now', '-7 days')
         GROUP BY task_hint
         ORDER BY count DESC
         LIMIT 10"
    )?;

    let task_rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })?;

    for task_result in task_rows {
        let (task_hint, count) = task_result?;
        if let Some(best_model) = get_best_model_for_task(conn, &task_hint, 10) {
            suggestions.push(RoutingSuggestion {
                task_hint,
                recommended_model: best_model,
                sample_size: count,
            });
        }
    }

    Ok(suggestions)
}

pub struct RoutingSuggestion {
    pub task_hint: String,
    pub recommended_model: String,
    pub sample_size: i64,
}
