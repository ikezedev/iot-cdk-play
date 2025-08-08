mod types;

use aws_iot_device_sdk_rust::{
    AWSIoTSettings, async_client::AWSIoTAsyncClient, async_event_loop_listener,
};
use chrono::Utc;
use prost::Message;
use rand::Rng;
use rumqttc::{ClientError, Packet, QoS};
use std::time::Duration;

use crate::types::{Humidity, Temperature};

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let (temp_client, temp_eventloop) =
        AWSIoTAsyncClient::new(aws_settings("rust-client-1")?).await?;
    let (humidity_client, humidity_eventloop) =
        AWSIoTAsyncClient::new(aws_settings("rust-client-2")?).await?;

    let mut temp_receiver = temp_client.get_receiver().await;
    let mut humidity_receiver = humidity_client.get_receiver().await;

    let recv_thread = tokio::spawn(async move {
        loop {
            if let Ok(event) = temp_receiver.recv().await {
                match event {
                    Packet::Publish(p) => {
                        println!("Received message {:?} on topic: {}", p.payload, p.topic)
                    }
                    _ => println!("Got event on temp_receiver: {:?}", event),
                }
            }
            if let Ok(event) = humidity_receiver.recv().await {
                match event {
                    Packet::Publish(p) => {
                        println!("Received message {:?} on topic: {}", p.payload, p.topic)
                    }
                    _ => println!("Got event on humidity_receiver: {:?}", event),
                }
            }
        }
    });

    let listen_thread = tokio::spawn(async move {
        tokio::join!(
            async_event_loop_listener(temp_eventloop),
            async_event_loop_listener(humidity_eventloop)
        )
    });

    let temp_publisher = tokio::spawn(async move {
        let temperature_device_id = "temperature_sensor_1".to_string();
        for temp in random_number_generator() {
            temp_client
                .publish(
                    "monitoring/temperature",
                    QoS::AtLeastOnce,
                    Temperature {
                        device_id: temperature_device_id.clone(),
                        value: temp as f32,
                        timestamp: Utc::now().timestamp_millis() as u64,
                    }
                    .encode_to_vec(),
                )
                .await?;
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        Ok::<(), ClientError>(())
    });

    let humidity_publisher = tokio::spawn(async move {
        let humidity_device_id = "humidity_sensor_1".to_string();
        for humidity in random_number_generator() {
            humidity_client
                .publish(
                    "monitoring/humidity",
                    QoS::AtLeastOnce,
                    Humidity {
                        device_id: humidity_device_id.clone(),
                        value: humidity as f32,
                        timestamp: Utc::now().timestamp_millis() as u64,
                    }
                    .encode_to_vec(),
                )
                .await?;
            tokio::time::sleep(Duration::from_secs(1)).await
        }
        Ok::<(), ClientError>(())
    });

    match tokio::join!(
        temp_publisher,
        humidity_publisher,
        recv_thread,
        listen_thread
    ) {
        (Ok(_), Ok(_), Ok(_), Ok(_)) => (),
        _ => panic!("Error in threads"),
    }
    Ok(())
}

fn random_number_generator() -> impl Iterator<Item = u16> {
    (0..).map(|_| rand::rng().random_range(1..=100))
}

fn aws_settings(client_id: &str) -> Result<AWSIoTSettings, Box<dyn std::error::Error>> {
    let ca_path = "certs/root-CA.crt";
    let client_cert_path = "certs/Test.cert.pem";
    let client_key_path = "certs/Test.private.key";
    let aws_iot_endpoint = std::env::var("MQTT_BROKER_URL")?;

    Ok(AWSIoTSettings::new(
        client_id.to_string(),
        ca_path.to_string(),
        client_cert_path.to_string(),
        client_key_path.to_string(),
        aws_iot_endpoint,
        None,
    ))
}
