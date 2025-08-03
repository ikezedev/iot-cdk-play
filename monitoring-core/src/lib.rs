mod types;

use chrono::Utc;
use prost::Message;
use rand::Rng;
use rumqttc::{Client, MqttOptions, QoS};
use std::thread::{self};
use std::time::Duration;

use crate::types::{Humidity, Temperature};

pub fn run() {
    let mut mqttoptions = MqttOptions::new("test-2", "127.0.0.1", 1883);
    mqttoptions.set_keep_alive(Duration::ZERO);

    let (client, mut connection) = Client::new(mqttoptions, 10);
    let temp_client = client.clone();
    let temperature_device_id = "temperature_sensor_1".to_string();

    thread::spawn(move || {
        for temp in random_number_generator().take(10) {
            temp_client
                .publish(
                    "monitoring/temperature",
                    QoS::AtLeastOnce,
                    false,
                    Temperature {
                        device_id: temperature_device_id.clone(),
                        value: temp as f32,
                        timestamp: Utc::now().timestamp_millis() as u64,
                    }
                    .encode_to_vec(),
                )
                .inspect_err(|e| eprintln!("Failed to publish temperature: {}", e))
                .unwrap();
            thread::sleep(Duration::from_secs(1));
        }
    });

    let humidity_device_id = "humidity_sensor_1".to_string();

    thread::spawn(move || {
        for humidity in random_number_generator().take(10) {
            client
                .publish(
                    "monitoring/humidity",
                    QoS::AtLeastOnce,
                    false,
                    Humidity {
                        device_id: humidity_device_id.clone(),
                        value: humidity as f32,
                        timestamp: Utc::now().timestamp_millis() as u64,
                    }
                    .encode_to_vec(),
                )
                .inspect_err(|e| eprintln!("Failed to publish humidity: {}", e))
                .unwrap();
            thread::sleep(Duration::from_secs(1));
        }
    });

    for event in connection.iter() {
        match event {
            Ok(rumqttc::Event::Incoming(rumqttc::Packet::Publish(p))) => {
                println!("Received publish on topic: {}", p.topic);
                if p.topic == "monitoring/temperature" {
                    let temp: Temperature = Temperature::decode(p.payload.as_ref()).unwrap();
                    println!(
                        "Received temperature from {}: {} at {}",
                        temp.device_id, temp.value, temp.timestamp
                    );
                } else if p.topic == "monitoring/humidity" {
                    let humidity: Humidity = Humidity::decode(p.payload.as_ref()).unwrap();
                    println!(
                        "Received humidity from {}: {} at {}",
                        humidity.device_id, humidity.value, humidity.timestamp
                    );
                }
            }
            Err(e) => eprintln!("Error in connection: {}", e),
            _ => {}
        }
    }
}

fn random_number_generator() -> impl Iterator<Item = u16> {
    (0..).map(|_| rand::rng().random_range(1..=100))
}
