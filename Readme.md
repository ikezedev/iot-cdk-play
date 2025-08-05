# Embedded ~ IOT Core ~ Dynamo DB ~ React App

A demonstration of a possible IoT devices setup, with Rust binary for the sensor, AWS CDK to orchestrate IoT Things, and other infratructures needed to subsrcipe to the topic published by the sensors and write the data to a DynamoDB. And also (in progress) a react app that connects to API gateway that will fetch data from the data as clients requests come in.

## System Design

<img src="./design.svg">

## Todos

- React APP
- CI/CI with GitHub action
