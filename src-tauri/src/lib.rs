use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use sysinfo::System;
use tauri::{AppHandle, Emitter, State};

mod can;
mod serial;

use can::{
    parse_binding_to_raw, CanPacket, DeviceType, DiscoveredNode, CMD_ANNOUNCE, NODE_UNASSIGNED,
};
use serial::SerialManager;

pub struct TelemetryState {
    pub sys: Mutex<System>,
}

#[derive(Default)]
pub struct NodeRegistry {
    pub nodes: Mutex<HashMap<u32, DiscoveredNode>>,
    pub next_node_id: Mutex<u8>,
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self {
            nodes: Mutex::new(HashMap::new()),
            next_node_id: Mutex::new(0x02),
        }
    }

    pub fn register_announcement(&self, packet: &CanPacket) -> Option<(DiscoveredNode, CanPacket)> {
        let (_, node_id, cmd) = CanPacket::parse_id(packet.id);

        if cmd != CMD_ANNOUNCE || node_id != NODE_UNASSIGNED {
            return None;
        }

        let uid = u32::from_be_bytes([
            packet.data[0],
            packet.data[1],
            packet.data[2],
            packet.data[3],
        ]);
        let dev_type = DeviceType::from(packet.data[4]);
        let rows = packet.data[5];
        let cols = packet.data[6];
        let fw_byte = packet.data[7];
        let fw_ver = format!("v{}.{}", fw_byte >> 4, fw_byte & 0x0F);

        let mut nodes = self.nodes.lock().unwrap();

        let assigned_id = if let Some(existing) = nodes.get(&uid) {
            existing.assigned_node_id
        } else {
            let mut next_id = self.next_node_id.lock().unwrap();
            let id = *next_id;
            *next_id += 1;
            id
        };

        let discovered = DiscoveredNode {
            assigned_node_id: assigned_id,
            uid,
            device_type: dev_type,
            rows,
            cols,
            firmware_ver: fw_ver,
        };

        nodes.insert(uid, discovered.clone());
        let response_packet = CanPacket::create_assign_id_frame(uid, assigned_id);

        Some((discovered, response_packet))
    }
}

pub struct AppState {
    pub registry: Arc<NodeRegistry>,
    pub serial: Arc<SerialManager>,
}

#[derive(serde::Serialize, Clone)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub ram_used_gb: f32,
    pub ram_total_gb: f32,
    pub ram_percentage: f32,
}

#[tauri::command]
fn get_system_stats(state: State<TelemetryState>) -> SystemStats {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_info().cpu_usage();
    let ram_used_gb = sys.used_memory() as f32 / 1024.0 / 1024.0 / 1024.0;
    let ram_total_gb = sys.total_memory() as f32 / 1024.0 / 1024.0 / 1024.0;
    let ram_percentage = if ram_total_gb > 0.0 {
        (ram_used_gb / ram_total_gb) * 100.0
    } else {
        0.0
    };

    SystemStats {
        cpu_usage,
        ram_used_gb,
        ram_total_gb,
        ram_percentage,
    }
}

#[tauri::command]
fn list_serial_ports() -> Vec<String> {
    SerialManager::list_ports()
}

#[tauri::command]
fn connect_serial(
    app: AppHandle,
    state: State<AppState>,
    port_name: String,
) -> Result<String, String> {
    state
        .serial
        .connect(&port_name, app, Arc::clone(&state.registry))?;
    Ok(format!("Connected to {}", port_name))
}

#[tauri::command]
fn simulate_hardware_plug(
    app: AppHandle,
    state: State<AppState>,
    device_type: u8,
    rows: u8,
    cols: u8,
    simulated_uid: u32,
) -> Result<DiscoveredNode, String> {
    let mut data = [0u8; 8];
    data[0..4].copy_from_slice(&simulated_uid.to_be_bytes());
    data[4] = device_type;
    data[5] = rows;
    data[6] = cols;
    data[7] = 0x10;

    let packet = CanPacket {
        id: CanPacket::build_id(0x0, NODE_UNASSIGNED, CMD_ANNOUNCE),
        dlc: 8,
        data,
    };

    if let Some((node, _resp_packet)) = state.registry.register_announcement(&packet) {
        app.emit("node-discovered", &node).map_err(|e| e.to_string())?;
        Ok(node)
    } else {
        Err("Failed to process announce frame".into())
    }
}

#[tauri::command]
fn send_key_remap(
    state: State<AppState>,
    node_id: u8,
    switch_index: u8,
    layer: u8,
    keycode_str: String,
) -> Result<CanPacket, String> {
    let (key_type, modifier_mask, keycode) = parse_binding_to_raw(&keycode_str);

    let frame = CanPacket::create_key_remap_frame(
        node_id,
        switch_index,
        layer,
        key_type,
        modifier_mask,
        keycode,
    );

    println!(
        ">>> [CAN TX] Target Node: 0x{:02X} | ID: 0x{:03X} | Data: {:02X?}",
        node_id, frame.id, frame.data
    );

    // Write to hardware if connected, otherwise just return the packet
    let _ = state.serial.write_packet(&frame);

    Ok(frame)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let registry = Arc::new(NodeRegistry::new());
    let serial = Arc::new(SerialManager::new());

    tauri::Builder::default()
        .manage(TelemetryState {
            sys: Mutex::new(System::new_all()),
        })
        .manage(AppState { registry, serial })
        .invoke_handler(tauri::generate_handler![
            get_system_stats,
            simulate_hardware_plug,
            send_key_remap,
            list_serial_ports,
            connect_serial
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}