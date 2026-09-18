const { SerialPort } = require('serialport');

const port = new SerialPort({ path: 'COM11', baudRate: 115200 }, (err) => {
  if (err) {
    console.error('Error opening COM11:', err.message);
  }
});

function makeFrame(canId, dlc, dataBytes) {
  const frame = Buffer.alloc(13);
  frame[0] = 0xaa;
  frame[1] = 0x55;
  frame[2] = (canId >> 8) & 0xff;
  frame[3] = canId & 0xff;
  frame[4] = dlc;
  Buffer.from(dataBytes).copy(frame, 5);

  let checksum = 0;
  for (let i = 2; i < 12; i++) checksum ^= frame[i];
  frame[12] = checksum;
  return frame;
}

let rxBuffer = Buffer.alloc(0);
let assigned = false;
let announceTimer = null;

port.on('open', () => {
  console.log('Connected to COM11 (Mock Hardware Node)');

  // CAN ID for Announce: Priority 0, Node 0x0F, CMD 0x00 -> 0x00F0
  const canId = (0x0 << 8) | (0x0f << 4) | 0x00;
  // UID: 0x11223344, Type 3 (Macropad), Rows 4, Cols 4, FW v1.0 (0x10)
  const payload = [0x11, 0x22, 0x33, 0x44, 0x03, 0x04, 0x04, 0x10];
  const packet = makeFrame(canId, 8, payload);

  console.log('Broadcasting CMD_ANNOUNCE every 1s until linked...');
  port.write(packet);

  // Keep repeating announce until Tauri sends back the assigned ID
  announceTimer = setInterval(() => {
    if (!assigned) {
      console.log('Sending CMD_ANNOUNCE...');
      port.write(packet);
    }
  }, 1000);
});

port.on('data', (chunk) => {
  rxBuffer = Buffer.concat([rxBuffer, chunk]);

  // Frame search loop
  while (rxBuffer.length >= 13) {
    // Look for header 0xAA 0x55
    if (rxBuffer[0] !== 0xaa || rxBuffer[1] !== 0x55) {
      rxBuffer = rxBuffer.subarray(1);
      continue;
    }

    const frame = rxBuffer.subarray(0, 13);
    rxBuffer = rxBuffer.subarray(13);

    // Verify Checksum
    let checksum = 0;
    for (let i = 2; i < 12; i++) checksum ^= frame[i];

    if (checksum !== frame[12]) {
      console.log('Checksum mismatch, discarding frame.');
      continue;
    }

    const canId = (frame[2] << 8) | frame[3];
    const cmd = canId & 0x0f;

    if (cmd === 0x01) {
      // CMD_ASSIGN_ID
      assigned = true;
      clearInterval(announceTimer);
      const assignedId = frame[9];
      console.log(`\n🎉 Success! Hub assigned Node ID: 0x${assignedId.toString(16).padStart(2, '0')}`);
      console.log('Listening for key remaps from the Tauri app...\n');
    } else if (cmd === 0x03) {
      // CMD_KEY_REMAP
      const swIdx = frame[5];
      const layer = frame[6];
      const keycode = (frame[9] << 8) | frame[10];
      console.log(`>> [RX FROM APP] Switch SW${swIdx + 1} (Layer ${layer}) Remapped! Keycode: 0x${keycode.toString(16).padStart(4, '0')}`);
    }
  }
});