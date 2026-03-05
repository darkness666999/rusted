use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::mpsc::Sender;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};

pub fn start_listening(tx: Sender<Vec<u8>>, running: Arc<AtomicBool>) -> Result<cpal::Stream, String> {
    println!("Audio capture: iniciando stream de audio...");
    let host = cpal::default_host();
    let device = host.default_output_device().ok_or("No output device")?;
    let config = device.default_output_config().map_err(|e| e.to_string())?;

    let tx_callback = tx.clone();

    let stream = device.build_input_stream(
        &config.into(),
       move |data: &[f32], _| {
        if !running.load(Ordering::Relaxed) { return; }
        let mut bytes = Vec::with_capacity(data.len() * 4);
        for &sample in data {
            let s = (sample * 10.0).clamp(-1.0, 1.0);
            bytes.extend_from_slice(&s.to_le_bytes()); 
        }
        let _ = tx_callback.send(bytes);
    },
        |err| eprintln!("Audio hardware error: {}", err),
        None
    ).map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;
    Ok(stream)
}