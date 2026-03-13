//! Request metrics logger

use super::metrics::RequestMetrics;
use super::schema;
use rusqlite::Connection;
use std::path::Path;

pub struct UsageLogger {
    db: Connection,
}

impl UsageLogger {
    pub fn new(db_path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let db = Connection::open(db_path)?;
        schema::init_schema(&db)?;

        Ok(Self { db })
    }

    pub fn log(&self, metrics: &RequestMetrics) -> Result<(), Box<dyn std::error::Error>> {
        schema::insert_metrics(&self.db, metrics)?;
        Ok(())
    }
}
