use clap::Subcommand;

#[derive(Subcommand)]
pub enum BenchmarkCommand {
    Run { task: String },
    Compare { models: String },
}

pub async fn handle_benchmark(cmd: BenchmarkCommand) -> Result<(), Box<dyn std::error::Error>> {
    match cmd {
        BenchmarkCommand::Run { task } => println!("Running benchmark for: {}", task),
        BenchmarkCommand::Compare { models } => println!("Comparing: {}", models),
    }
    Ok(())
}
