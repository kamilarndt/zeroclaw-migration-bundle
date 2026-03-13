use clap::Subcommand;
use quota_tracker::{QuotaTracker, QuotaConfig};
use anyhow::Result;

#[derive(Subcommand, Debug)]
pub enum QuotaCommand {
    Status,
    Reset,
}

pub async fn handle_quota(cmd: QuotaCommand) -> Result<()> {
    match cmd {
        QuotaCommand::Status => {
            let config = QuotaConfig::default();
            let tracker = QuotaTracker::new(config)?;
            println!("Quota: {:.1}%", tracker.get_usage_percentage() * 100.0);
        }
        QuotaCommand::Reset => {
            let config = QuotaConfig::default();
            let tracker = QuotaTracker::new(config)?;
            tracker.reset_daily()?;
            println!("Reset complete");
        }
    }
    Ok(())
}
