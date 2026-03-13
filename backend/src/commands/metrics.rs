use clap::Parser;

#[derive(Parser)]
pub struct MetricsCommand {
    #[clap(short, long, default_value = "7")]
    period: u32,
}

pub async fn handle_metrics(cmd: MetricsCommand) -> Result<(), Box<dyn std::error::Error>> {
    println!("Metrics report ({} days)", cmd.period);
    Ok(())
}
