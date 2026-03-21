/// Stress Test Binary for All 4 Priorities
/// Run with: cargo run --bin stress_test_priorities

use std::time::Instant;
use zeroclawlabs::health::{get_system_metrics, mark_component_ok, mark_component_error, snapshot};
use zeroclawlabs::runtime::create_runtime;
use zeroclawlabs::config::RuntimeConfig;
use zeroclawlabs::agent::prompt::UNCODEX_5_GUIDELINES;

fn main() {
    println!("=== ZEROCLAW PRIORITY STRESS TEST ===\n");

    // Test Priority 2: Firecracker Runtime
    println!("### PRIORITY 2: Zeroboot (Firecracker Runtime)");
    test_firecracker_stress();
    println!();

    // Test Priority 4: Kula Health Checks
    println!("### PRIORITY 4: Kula (Lightweight Health Checks)");
    test_health_stress();
    println!();

    // Test Priority 3: Uncodex-5 Guidelines
    println!("### PRIORITY 3: Uncodex-5 (Enterprise UI Guidelines)");
    test_uncodex_stress();
    println!();

    println!("=== ALL STRESS TESTS PASSED ===");
}

fn test_firecracker_stress() {
    // Benchmark: Create 1000 runtime instances
    let iterations = 1000;
    let start = Instant::now();

    for i in 0..iterations {
        let cfg = RuntimeConfig {
            kind: "firecracker".into(),
            ..Default::default()
        };

        match create_runtime(&cfg) {
            Ok(rt) => {
                if i == 0 {
                    println!("✓ Runtime created: {}", rt.name());
                    println!("  - Shell access: {}", rt.has_shell_access());
                    println!("  - Filesystem access: {}", rt.has_filesystem_access());
                    println!("  - Long running: {}", rt.supports_long_running());
                    println!("  - Memory budget: {} MB", rt.memory_budget() / (1024 * 1024));
                }
            }
            Err(e) => {
                panic!("Runtime {} failed: {}", i, e);
            }
        }
    }

    let elapsed = start.elapsed();
    let avg_time = elapsed.as_micros() as f64 / iterations as f64;
    println!("✓ Created {} runtimes in {:?}", iterations, elapsed);
    println!("  Average: {:.2}μs per runtime", avg_time);

    // Verify performance target (<1ms)
    assert!(avg_time < 1000.0, "Runtime creation too slow: {:.2}μs", avg_time);
    println!("✓ Performance target met (<1ms per creation)");
}

fn test_health_stress() {
    // Benchmark: Read metrics 10,000 times
    let iterations = 10_000;
    let start = Instant::now();

    let mut cpu_values = Vec::new();
    let mut memory_values = Vec::new();

    for i in 0..iterations {
        let metrics = get_system_metrics();

        // Verify data integrity
        assert!(metrics.cpu_percent >= 0.0 && metrics.cpu_percent <= 100.0,
                "CPU out of range at iteration {}", i);
        assert!(metrics.memory_mb > 0, "Memory should be positive at iteration {}", i);
        assert!(metrics.memory_total_mb > 0, "Total memory should be positive at iteration {}", i);

        if i == 0 {
            println!("✓ System metrics:");
            println!("  - CPU: {:.1}%", metrics.cpu_percent);
            println!("  - Memory: {} MB / {} MB ({:.1}%)",
                     metrics.memory_mb, metrics.memory_total_mb, metrics.memory_percent);
            println!("  - Load: {:.2} {:.2} {:.2}",
                     metrics.load_1m, metrics.load_5m, metrics.load_15m);
        }

        // Collect samples for analysis
        if i % 100 == 0 {
            cpu_values.push(metrics.cpu_percent);
            memory_values.push(metrics.memory_mb);
        }
    }

    let elapsed = start.elapsed();
    let avg_time = elapsed.as_nanos() as f64 / iterations as f64;
    println!("✓ Read metrics {} times in {:?}", iterations, elapsed);
    println!("  Average: {:.2}ns per read", avg_time);

    // Verify performance target (<100μs)
    assert!(avg_time < 100_000.0, "Metrics read too slow: {:.2}ns", avg_time);
    println!("✓ Performance target met (<100μs per read)");

    // Test component health tracking
    let components = 100;
    let start = Instant::now();

    for i in 0..components {
        let component = format!("stress-component-{}", i);
        mark_component_ok(&component);

        if i % 10 == 0 {
            mark_component_error(&component, "test error");
        }
    }

    let elapsed = start.elapsed();
    println!("✓ Updated {} components in {:?}", components, elapsed);

    let snap = snapshot();
    assert_eq!(snap.components.len(), components);
    println!("✓ All {} components tracked correctly", components);
}

fn test_uncodex_stress() {
    let guidelines = UNCODEX_5_GUIDELINES;

    // Verify guidelines exist
    println!("✓ Uncodex-5 Guidelines length: {} chars", guidelines.len());
    assert!(guidelines.len() > 1000, "Guidelines should be comprehensive");

    // Verify key sections
    let sections = vec![
        "Color Palette",
        "Typography",
        "Glassmorphism",
        "Dark Mode",
        "Accessibility",
        "Performance",
        "Anti-Patterns",
    ];

    for section in &sections {
        assert!(guidelines.contains(section), "Missing section: {}", section);
    }
    println!("✓ All {} key sections present", sections.len());

    // Verify Vercel principles
    let principles = vec![
        "#000000",           // Black background
        "#0070F3",           // Vercel blue
        "rgba(255, 255, 255, 0.05)",  // Glass surface
        "Inter",             // Font
        "8px",               // Spacing unit
    ];

    for principle in &principles {
        assert!(guidelines.contains(principle), "Missing principle: {}", principle);
    }
    println!("✓ All {} Vercel principles present", principles.len());

    // Benchmark: Parse guidelines 1000 times
    let iterations = 1000;
    let start = Instant::now();

    for _ in 0..iterations {
        let g = UNCODEX_5_GUIDELINES;
        assert!(!g.is_empty());
        assert!(g.contains("Color Palette"));
    }

    let elapsed = start.elapsed();
    let avg_time = elapsed.as_micros() as f64 / iterations as f64;
    println!("✓ Parsed guidelines {} times in {:?}", iterations, elapsed);
    println!("  Average: {:.2}μs per parse", avg_time);

    // Verify performance target (<1ms)
    assert!(avg_time < 1000.0, "Guidelines parse too slow: {:.2}μs", avg_time);
    println!("✓ Performance target met (<1ms per parse)");
}
