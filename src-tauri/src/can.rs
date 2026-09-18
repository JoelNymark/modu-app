#![allow(dead_code)]

use serde::{Deserialize, Serialize};

// Reserved System Node Addresses
pub const NODE_BROADCAST: u8 = 0x00;
pub const NODE_UNASSIGNED: u8 = 0x0F;

// Command IDs
pub const CMD_ANNOUNCE: u8 = 0x00;  // Node -> Hub: "Hello, I am UID X with type Y"
pub const CMD_ASSIGN_ID: u8 = 0x01; // Hub -> Node: "UID X, your new node ID is Y"
pub const CMD_TELEMETRY: u8 = 0x02; // App -> Screen Node
pub const CMD_KEY_REMAP: u8 = 0x03; // App -> Macropad Node
pub const CMD_KEY_EVENT: u8 = 0x04; // Macropad Node -> Hub (Key pressed/released)

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum DeviceType {
    Hub = 0x01,
    Screen = 0x02,
    Macropad = 0x03,
    EncoderDeck = 0x04,
    Unknown = 0xFF,
}

impl From<u8> for DeviceType {
    fn from(val: u8) -> Self {
        match val {
            0x01 => DeviceType::Hub,
            0x02 => DeviceType::Screen,
            0x03 => DeviceType::Macropad,
            0x04 => DeviceType::EncoderDeck,
            _ => DeviceType::Unknown,
        }
    }
}

/// Metadata extracted from a hardware announce frame
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredNode {
    pub assigned_node_id: u8,
    pub uid: u32,
    pub device_type: DeviceType,
    pub rows: u8,
    pub cols: u8,
    pub firmware_ver: String,
}

/// Standard 8-byte CAN frame
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct CanPacket {
    pub id: u16,
    pub dlc: u8,
    pub data: [u8; 8],
}

impl CanPacket {
    /// Builds 11-bit CAN Identifier
    pub fn build_id(priority: u8, node: u8, cmd: u8) -> u16 {
        (((priority & 0x07) as u16) << 8) | (((node & 0x0F) as u16) << 4) | ((cmd & 0x0F) as u16)
    }

    /// Extracts (priority, node_id, cmd) from an 11-bit CAN ID
    pub fn parse_id(id: u16) -> (u8, u8, u8) {
        let priority = ((id >> 8) & 0x07) as u8;
        let node_id = ((id >> 4) & 0x0F) as u8;
        let cmd = (id & 0x0F) as u8;
        (priority, node_id, cmd)
    }

    /// Creates an assignment response packet to grant a node its bus address
    pub fn create_assign_id_frame(uid: u32, assigned_node_id: u8) -> Self {
        let mut data = [0u8; 8];
        data[0..4].copy_from_slice(&uid.to_be_bytes());
        data[4] = assigned_node_id;

        Self {
            id: Self::build_id(0x1, NODE_UNASSIGNED, CMD_ASSIGN_ID),
            dlc: 5,
            data,
        }
    }

    /// Telemetry frame directed to a dynamic node ID
    pub fn create_telemetry_frame(
        target_node_id: u8,
        cpu_usage: f32,
        ram_used_gb: f32,
        ram_total_gb: f32,
        brightness: u8,
    ) -> Self {
        let cpu_byte = cpu_usage.clamp(0.0, 100.0).round() as u8;
        let ram_pct = ((ram_used_gb / ram_total_gb.max(1.0)) * 100.0).clamp(0.0, 100.0) as u8;
        let ram_used_mb = (ram_used_gb * 1024.0) as u16;
        let ram_total_mb = (ram_total_gb * 1024.0) as u16;

        let data = [
            cpu_byte,
            ram_pct,
            (ram_used_mb >> 8) as u8,
            (ram_used_mb & 0xFF) as u8,
            (ram_total_mb >> 8) as u8,
            (ram_total_mb & 0xFF) as u8,
            brightness,
            0x00,
        ];

        Self {
            id: Self::build_id(0x3, target_node_id, CMD_TELEMETRY),
            dlc: 8,
            data,
        }
    }

    /// Key remap frame directed to a dynamic node ID
    pub fn create_key_remap_frame(
        target_node_id: u8,
        switch_index: u8,
        layer: u8,
        key_type: u8,
        modifier_mask: u8,
        keycode: u16,
    ) -> Self {
        let data = [
            switch_index,
            layer,
            key_type,
            modifier_mask,
            (keycode >> 8) as u8,
            (keycode & 0xFF) as u8,
            0x00,
            0x00,
        ];

        Self {
            id: Self::build_id(0x7, target_node_id, CMD_KEY_REMAP),
            dlc: 8,
            data,
        }
    }

    /// Encodes this CAN frame into a 13-byte serial transmission buffer
    pub fn to_serial_frame(&self) -> [u8; 13] {
        let mut buf = [0u8; 13];
        buf[0] = 0xAA; // Sync byte 1
        buf[1] = 0x55; // Sync byte 2
        buf[2] = (self.id >> 8) as u8;
        buf[3] = (self.id & 0xFF) as u8;
        buf[4] = self.dlc;
        buf[5..13].copy_from_slice(&self.data);

        // Calculate simple XOR checksum across bytes 2..12
        let mut checksum = 0u8;
        for b in &buf[2..12] {
            checksum ^= *b;
        }
        buf[12] = checksum;
        buf
    }

    /// Attempts to parse a 13-byte slice into a valid CanPacket
    pub fn from_serial_frame(buf: &[u8]) -> Option<Self> {
        if buf.len() < 13 || buf[0] != 0xAA || buf[1] != 0x55 {
            return None;
        }

        let mut checksum = 0u8;
        for b in &buf[2..12] {
            checksum ^= *b;
        }

        if checksum != buf[12] {
            return None; // Checksum mismatch
        }

        let id = ((buf[2] as u16) << 8) | (buf[3] as u16);
        let dlc = buf[4];
        let mut data = [0u8; 8];
        data.copy_from_slice(&buf[5..13]);

        Some(Self { id, dlc, data })
    }
}

/// Maps frontend keycode strings (e.g., "KC_A", "KC_MUTE") to:
/// (key_type, modifier_mask, 16-bit keycode)
pub fn parse_binding_to_raw(code: &str) -> (u8, u8, u16) {
    // 1. Letters: KC_A (0x04) .. KC_Z (0x1D)
    if let Some(letter) = code.strip_prefix("KC_") {
        if letter.len() == 1 {
            let ch = letter.chars().next().unwrap();
            if ch.is_ascii_uppercase() {
                let offset = (ch as u8) - b'A';
                return (0x01, 0x00, 0x0004 + offset as u16);
            }
            if ch.is_ascii_digit() {
                let offset = if ch == '0' { 9 } else { (ch as u8) - b'1' };
                return (0x01, 0x00, 0x001E + offset as u16);
            }
        }
    }

    // 2. Function Keys: KC_F1 (0x3A) .. KC_F12 (0x45)
    if let Some(f_str) = code.strip_prefix("KC_F") {
        if let Ok(f_num) = f_str.parse::<u16>() {
            if (1..=12).contains(&f_num) {
                return (0x01, 0x00, 0x003A + (f_num - 1));
            }
        }
    }

    // 3. Punctuation, Modifiers, Media & Shortcuts
    match code {
        "KC_ENT" => (0x01, 0x00, 0x0028),
        "KC_ESC" => (0x01, 0x00, 0x0029),
        "KC_BSPC" => (0x01, 0x00, 0x002A),
        "KC_TAB" => (0x01, 0x00, 0x002B),
        "KC_SPC" => (0x01, 0x00, 0x002C),
        "KC_MINS" => (0x01, 0x00, 0x002D),
        "KC_EQL" => (0x01, 0x00, 0x002E),
        "KC_LBRC" => (0x01, 0x00, 0x002F),
        "KC_RBRC" => (0x01, 0x00, 0x0030),
        "KC_BSLS" => (0x01, 0x00, 0x0031),
        "KC_SCLN" => (0x01, 0x00, 0x0033),
        "KC_QUOT" => (0x01, 0x00, 0x0034),
        "KC_GRV" => (0x01, 0x00, 0x0035),
        "KC_COMM" => (0x01, 0x00, 0x0036),
        "KC_DOT" => (0x01, 0x00, 0x0037),
        "KC_SLSH" => (0x01, 0x00, 0x0038),
        "KC_CAPS" => (0x01, 0x00, 0x0039),

        // Navigation
        "KC_RGHT" => (0x01, 0x00, 0x004F),
        "KC_LEFT" => (0x01, 0x00, 0x0050),
        "KC_DOWN" => (0x01, 0x00, 0x0051),
        "KC_UP" => (0x01, 0x00, 0x0052),
        "KC_DEL" => (0x01, 0x00, 0x004C),
        "KC_HOME" => (0x01, 0x00, 0x004A),
        "KC_END" => (0x01, 0x00, 0x004D),
        "KC_PGUP" => (0x01, 0x00, 0x004B),
        "KC_PGDN" => (0x01, 0x00, 0x004E),

        // Standalone Modifiers
        "KC_LCTL" => (0x01, 0x01, 0x00E0),
        "KC_LSFT" => (0x01, 0x02, 0x00E1),
        "KC_LALT" => (0x01, 0x04, 0x00E2),
        "KC_LGUI" => (0x01, 0x08, 0x00E3),

        // Media Controls
        "KC_MUTE" => (0x02, 0x00, 0x00E2),
        "KC_VOLU" => (0x02, 0x00, 0x00E9),
        "KC_VOLD" => (0x02, 0x00, 0x00EA),
        "KC_MNXT" => (0x02, 0x00, 0x00B5),
        "KC_MPRV" => (0x02, 0x00, 0x00B6),
        "KC_MPLY" => (0x02, 0x00, 0x00CD),

        // Shortcuts
        "M_COPY" => (0x01, 0x01, 0x0006),
        "M_PASTE" => (0x01, 0x01, 0x0019),
        "M_UNDO" => (0x01, 0x01, 0x001D),
        "M_TASK" => (0x03, 0x00, 0x0001),
        "M_DISCORD_MUTE" => (0x03, 0x00, 0x0002),

        _ => (0x00, 0x00, 0x0000),
    }
}



pub fn build_id(priority: u8, node: u8, cmd: u8) -> u16 {
    (((priority & 0x07) as u16) << 8) | (((node & 0x0F) as u16) << 4) | ((cmd & 0x0F) as u16)
}

pub fn parse_id(id: u16) -> (u8, u8, u8) {
    let priority = ((id >> 8) & 0x07) as u8;
    let node_id = ((id >> 4) & 0x0F) as u8;
    let cmd = (id & 0x0F) as u8;
    (priority, node_id, cmd)
}