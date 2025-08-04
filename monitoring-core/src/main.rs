#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv()?;
    match monitoring_core::run().await {
        Ok(_) => println!("Monitoring core ran successfully"),
        Err(e) => eprintln!("Monitoring core failed: {}", e),
    }
    Ok(())
}
