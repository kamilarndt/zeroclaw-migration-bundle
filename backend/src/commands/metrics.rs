use clap::Parser;
use anyhow::Result;

#[derive(Parser, Debug)]
pub struct MetricsCommand {
    #[clap(short, long, default_value = "7")]
    period: u32,
}

pub async fn handle_metrics(cmd: MetricsCommand) -> Result<()> {
    println!("Metrics report ({} days)", cmd.period);
    Ok(())
}
