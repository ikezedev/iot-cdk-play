#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Temperature {
    #[prost(string, tag = "1")]
    pub device_id: String,
    #[prost(float, tag = "2")]
    pub value: f32,
    #[prost(uint64, tag = "3")]
    pub timestamp: u64,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct Humidity {
    #[prost(string, tag = "1")]
    pub device_id: String,
    #[prost(float, tag = "2")]
    pub value: f32,
    #[prost(uint64, tag = "3")]
    pub timestamp: u64,
}
