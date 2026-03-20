use chrono::Utc;
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs;
use std::sync::OnceLock;
use std::time::Instant;

/// System metrics from /proc (lightweight, no external dependencies)
#[derive(Debug, Clone, Serialize)]
pub struct SystemMetrics {
    pub timestamp: String,
    pub cpu_percent: f64,
    pub memory_mb: u64,
    pub memory_total_mb: u64,
    pub memory_percent: f64,
    pub load_1m: f64,
    pub load_5m: f64,
    pub load_15m: f64,
}

/// Read /proc/meminfo to get memory usage
fn read_proc_meminfo() -> Result<(u64, u64), std::io::Error> {
    let content = fs::read_to_string("/proc/meminfo")?;
    let mut mem_total = 0u64;
    let mut mem_available = 0u64;

    for line in content.lines() {
        if line.starts_with("MemTotal:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            mem_total = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
        } else if line.starts_with("MemAvailable:") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            mem_available = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
        }
    }

    // If MemAvailable not available (older kernels), estimate from MemFree
    if mem_available == 0 {
        for line in content.lines() {
            if line.starts_with("MemFree:") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                mem_available = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
                break;
            }
        }
    }

    let used = mem_total.saturating_sub(mem_available);
    Ok((used, mem_total))
}

/// Read /proc/loadavg to get system load
fn read_proc_loadavg() -> Result<(f64, f64, f64), std::io::Error> {
    let content = fs::read_to_string("/proc/loadavg")?;
    let parts: Vec<&str> = content.split_whitespace().collect();

    let load_1m = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let load_5m = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let load_15m = parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0.0);

    Ok((load_1m, load_5m, load_15m))
}

/// Read /proc/stat to calculate CPU usage (simplified)
fn read_proc_stat_cpu() -> Result<f64, std::io::Error> {
    let content = fs::read_to_string("/proc/stat")?;
    let first_line = content.lines().next().unwrap_or("");

    // Format: cpu user nice system idle iowait irq softirq
    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 8 {
        return Ok(0.0);
    }

    let user: u64 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    let nice: u64 = parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);
    let system: u64 = parts.get(3).and_then(|s| s.parse().ok()).unwrap_or(0);
    let idle: u64 = parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0);

    let total = user + nice + system + idle;
    if total == 0 {
        return Ok(0.0);
    }

    let used = user + nice + system;
    let cpu_percent = (used as f64 / total as f64) * 100.0;

    Ok(cpu_percent)
}

/// Get current system metrics from /proc (lightweight, no dependencies)
pub fn get_system_metrics() -> SystemMetrics {
    let (mem_used, mem_total) = read_proc_meminfo().unwrap_or((0, 0));
    let (load_1m, load_5m, load_15m) = read_proc_loadavg().unwrap_or((0.0, 0.0, 0.0));
    let cpu_percent = read_proc_stat_cpu().unwrap_or(0.0);

    let memory_percent = if mem_total > 0 {
        (mem_used as f64 / mem_total as f64) * 100.0
    } else {
        0.0
    };

    SystemMetrics {
        timestamp: now_rfc3339(),
        cpu_percent,
        memory_mb: mem_used / 1024, // Convert KB to MB
        memory_total_mb: mem_total / 1024,
        memory_percent,
        load_1m,
        load_5m,
        load_15m,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ComponentHealth {
    pub status: String,
    pub updated_at: String,
    pub last_ok: Option<String>,
    pub last_error: Option<String>,
    pub restart_count: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthSnapshot {
    pub pid: u32,
    pub updated_at: String,
    pub uptime_seconds: u64,
    pub components: BTreeMap<String, ComponentHealth>,
}

struct HealthRegistry {
    started_at: Instant,
    components: Mutex<BTreeMap<String, ComponentHealth>>,
}

static REGISTRY: OnceLock<HealthRegistry> = OnceLock::new();

fn registry() -> &'static HealthRegistry {
    REGISTRY.get_or_init(|| HealthRegistry {
        started_at: Instant::now(),
        components: Mutex::new(BTreeMap::new()),
    })
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

fn upsert_component<F>(component: &str, update: F)
where
    F: FnOnce(&mut ComponentHealth),
{
    let mut map = registry().components.lock();
    let now = now_rfc3339();
    let entry = map
        .entry(component.to_string())
        .or_insert_with(|| ComponentHealth {
            status: "starting".into(),
            updated_at: now.clone(),
            last_ok: None,
            last_error: None,
            restart_count: 0,
        });
    update(entry);
    entry.updated_at = now;
}

pub fn mark_component_ok(component: &str) {
    upsert_component(component, |entry| {
        entry.status = "ok".into();
        entry.last_ok = Some(now_rfc3339());
        entry.last_error = None;
    });
}

#[allow(clippy::needless_pass_by_value)]
pub fn mark_component_error(component: &str, error: impl ToString) {
    let err = error.to_string();
    upsert_component(component, move |entry| {
        entry.status = "error".into();
        entry.last_error = Some(err);
    });
}

pub fn bump_component_restart(component: &str) {
    upsert_component(component, |entry| {
        entry.restart_count = entry.restart_count.saturating_add(1);
    });
}

pub fn snapshot() -> HealthSnapshot {
    let components = registry().components.lock().clone();

    HealthSnapshot {
        pid: std::process::id(),
        updated_at: now_rfc3339(),
        uptime_seconds: registry().started_at.elapsed().as_secs(),
        components,
    }
}

pub fn snapshot_json() -> serde_json::Value {
    serde_json::to_value(snapshot()).unwrap_or_else(|_| {
        serde_json::json!({
            "status": "error",
            "message": "failed to serialize health snapshot"
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_component(prefix: &str) -> String {
        format!("{prefix}-{}", uuid::Uuid::new_v4())
    }

    #[test]
    fn mark_component_ok_initializes_component_state() {
        let component = unique_component("health-ok");

        mark_component_ok(&component);

        let snapshot = snapshot();
        let entry = snapshot
            .components
            .get(&component)
            .expect("component should be present after mark_component_ok");

        assert_eq!(entry.status, "ok");
        assert!(entry.last_ok.is_some());
        assert!(entry.last_error.is_none());
    }

    #[test]
    fn mark_component_error_then_ok_clears_last_error() {
        let component = unique_component("health-error");

        mark_component_error(&component, "first failure");
        let error_snapshot = snapshot();
        let errored = error_snapshot
            .components
            .get(&component)
            .expect("component should exist after mark_component_error");
        assert_eq!(errored.status, "error");
        assert_eq!(errored.last_error.as_deref(), Some("first failure"));

        mark_component_ok(&component);
        let recovered_snapshot = snapshot();
        let recovered = recovered_snapshot
            .components
            .get(&component)
            .expect("component should exist after recovery");
        assert_eq!(recovered.status, "ok");
        assert!(recovered.last_error.is_none());
        assert!(recovered.last_ok.is_some());
    }

    #[test]
    fn bump_component_restart_increments_counter() {
        let component = unique_component("health-restart");

        bump_component_restart(&component);
        bump_component_restart(&component);

        let snapshot = snapshot();
        let entry = snapshot
            .components
            .get(&component)
            .expect("component should exist after restart bump");

        assert_eq!(entry.restart_count, 2);
    }

    #[test]
    fn get_system_metrics_returns_valid_data() {
        let metrics = get_system_metrics();

        assert!(metrics.cpu_percent >= 0.0 && metrics.cpu_percent <= 100.0);
        assert!(metrics.memory_mb > 0);
        assert!(metrics.memory_total_mb > 0);
        assert!(metrics.memory_percent >= 0.0 && metrics.memory_percent <= 100.0);
        assert!(metrics.load_1m >= 0.0);
    }

    #[test]
    fn snapshot_json_contains_registered_component_fields() {
        let component = unique_component("health-json");

        mark_component_ok(&component);

        let json = snapshot_json();
        let component_json = &json["components"][&component];

        assert_eq!(component_json["status"], "ok");
        assert!(component_json["updated_at"].as_str().is_some());
        assert!(component_json["last_ok"].as_str().is_some());
        assert!(json["uptime_seconds"].as_u64().is_some());
    }
}
