use clap::Subcommand;
use anyhow::Result;

#[derive(Subcommand, Debug)]
pub enum BenchmarkCommand {
    Run { task: String },
    Compare { models: String },
}

pub async fn handle_benchmark(cmd: BenchmarkCommand) -> Result<()> {
    match cmd {
        BenchmarkCommand::Run { task } => println!("Running benchmark for: {}", task),
        BenchmarkCommand::Compare { models } => println!("Comparing: {}", models),
    }
    Ok(())
}
