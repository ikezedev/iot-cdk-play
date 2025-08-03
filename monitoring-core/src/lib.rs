mod types;

use aws_iot_device_sdk_rust::{
    AWSIoTSettings, async_client::AWSIoTAsyncClient, async_event_loop_listener,
};
use chrono::Utc;
use prost::Message;
use rand::Rng;
use rumqttc::{ClientError, Packet, QoS};
use std::time::Duration;

use crate::types::Temperature;

pub async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let (temp_client, temp_eventloop_stuff) =
        AWSIoTAsyncClient::new(aws_settings("rust-client-1")?).await?;
    // let (humidity_client, humidity_eventloop_stuff) = AWSIoTAsyncClient::new(aws_settings("rust-client-2")?).await?;

    // tokio::spawn(async move {
    //     let humidity_device_id = "humidity_sensor_1".to_string();
    //     for humidity in random_number_generator().take(10) {
    //         client
    //             .publish(
    //                 "monitoring/humidity",
    //                 QoS::AtLeastOnce,
    //                 Humidity {
    //                     device_id: humidity_device_id.clone(),
    //                     value: humidity as f32,
    //                     timestamp: Utc::now().timestamp_millis() as u64,
    //                 }
    //                 .encode_to_vec(),
    //             )
    //             .await
    //             .inspect_err(|e| eprintln!("Failed to publish humidity: {}", e))
    //             .unwrap();
    //         tokio::time::sleep(Duration::from_secs(1)).await;
    //     }
    // });

    let mut receiver1 = temp_client.get_receiver().await;

    let recv1_thread = tokio::spawn(async move {
        loop {
            if let Ok(event) = receiver1.recv().await {
                println!("Received event on receiver1: {:?}", event);
                match event {
                    Packet::Publish(p) => {
                        println!("Received message {:?} on topic: {}", p.payload, p.topic)
                    }
                    _ => println!("Got event on receiver1: {:?}", event),
                }
            }
        }
    });

    let listen_thread = tokio::spawn(async move {
        async_event_loop_listener(temp_eventloop_stuff)
            .await
            .unwrap();
        //iot_core_client.listen().await.unwrap();
    });

    let publisher = tokio::spawn(async move {
        let temperature_device_id = "temperature_sensor_1".to_string();
        for temp in random_number_generator().take(10) {
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

    //iot_core_client.publish("topic".to_string(), QoS::AtMostOnce, "hey").await.unwrap();
    match tokio::join!(publisher, recv1_thread, listen_thread) {
        (Ok(_), Ok(_), Ok(_)) => (),
        _ => panic!("Error in threads"),
    }
    Ok(())
}

fn random_number_generator() -> impl Iterator<Item = u16> {
    (0..).map(|_| rand::rng().random_range(1..=100))
}

fn aws_settings(client_id: &str) -> Result<AWSIoTSettings, Box<dyn std::error::Error>> {
    let ca_path = "../certs/root-CA.crt";
    let client_cert_path = "../certs/Test.cert.pem";
    let client_key_path = "../certs/Test.private.key";
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
