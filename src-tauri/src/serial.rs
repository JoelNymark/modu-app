use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serialport::{ClearBuffer, SerialPort};
use tauri::{AppHandle, Emitter};

use crate::can::CanPacket;
use crate::NodeRegistry;

pub struct SerialManager {
    port: Arc<Mutex<Option<Box<dyn SerialPort>>>>,
}

impl SerialManager {
    pub fn new() -> Self {
        Self {
            port: Arc::new(Mutex::new(None)),
        }
    }

    /// Lists all available COM / tty ports on the system
    pub fn list_ports() -> Vec<String> {
        serialport::available_ports()
            .unwrap_or_default()
            .into_iter()
            .map(|p| p.port_name)
            .collect()
    }

    /// Connects to a port and launches the background packet reader thread
    pub fn connect(
        &self,
        port_name: &str,
        app_handle: AppHandle,
        registry: Arc<NodeRegistry>,
    ) -> Result<(), String> {
        let mut active_port = self.port.lock().unwrap();

        // Drop previous port connection if open
        if active_port.is_some() {
            *active_port = None;
        }

        let port_instance = serialport::new(port_name, 115_200)
            .timeout(Duration::from_millis(50))
            .open()
            .map_err(|e| format!("Failed to open {}: {}", port_name, e))?;

        let read_port = port_instance
            .try_clone()
            .map_err(|e| format!("Failed to clone serial port: {}", e))?;

        *active_port = Some(port_instance);

        let registry_clone = Arc::clone(&registry);
        let write_port_ref = Arc::clone(&self.port);

        // Background reader loop
        thread::spawn(move || {
            let mut port = read_port;
            let mut byte_buf = [0u8; 1];
            let mut frame_buf = Vec::with_capacity(13);

            let _ = port.clear(ClearBuffer::All);

            loop {
                match port.read_exact(&mut byte_buf) {
                    Ok(_) => {
                        let b = byte_buf[0];

                        // State machine synchronizing on 0xAA 0x55 header
                        if frame_buf.is_empty() {
                            if b == 0xAA {
                                frame_buf.push(b);
                            }
                        } else if frame_buf.len() == 1 {
                            if b == 0x55 {
                                frame_buf.push(b);
                            } else {
                                frame_buf.clear();
                            }
                        } else {
                            frame_buf.push(b);

                            // Full 13-byte frame collected
                            if frame_buf.len() == 13 {
                                if let Some(packet) = CanPacket::from_serial_frame(&frame_buf) {
                                    if let Some((node, resp)) =
                                        registry_clone.register_announcement(&packet)
                                    {
                                        println!(">>> Hardware Connected: {:?}", node);
                                        let _ = app_handle.emit("node-discovered", &node);

                                        // Reply with dynamic address allocation frame
                                        if let Ok(mut lock) = write_port_ref.lock() {
                                            if let Some(ref mut p) = *lock {
                                                let raw = resp.to_serial_frame();
                                                let _ = p.write_all(&raw);
                                            }
                                        }
                                    }
                                }
                                frame_buf.clear();
                            }
                        }
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {
                        thread::sleep(Duration::from_millis(5));
                    }
                    Err(_) => {
                        println!(">>> Serial port disconnected or closed.");
                        break;
                    }
                }
            }
        });

        Ok(())
    }

    /// Transmits a CAN frame over the open serial connection
    pub fn write_packet(&self, packet: &CanPacket) -> Result<(), String> {
        let mut lock = self.port.lock().unwrap();
        if let Some(ref mut port) = *lock {
            let encoded = packet.to_serial_frame();
            port.write_all(&encoded)
                .map_err(|e| format!("Serial write error: {}", e))?;
            port.flush().map_err(|e| format!("Flush error: {}", e))?;
            Ok(())
        } else {
            Err("No serial port connected".into())
        }
    }
}