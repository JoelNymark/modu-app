import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ModuleData, ScreenWidget, SystemStats } from './types';
import ScreenDesigner from './ScreenDesigner';
import KeymapEditor from './KeymapEditor';
import './App.css';

const INITIAL_MODULES: ModuleData[] = [
  {
    id: 'hub-main',
    name: 'Master Core',
    type: 'hub',
    connected: true,
    firmwareVersion: 'v0.1.0-alpha',
  },
  {
    id: 'screen-01',
    name: 'TFT Display 1.14"',
    type: 'screen',
    connected: true,
    firmwareVersion: 'v0.1.0-alpha',
    settings: {
      brightness: 85,
      activeLayout: 'Default Deck',
      widgets: [
        { id: 'w1', type: 'cpu_gauge', label: 'CPU Meter (%)', x: 6, y: 12, width: 123, height: 48, color: '#ef4444' },
        { id: 'w2', type: 'ram_gauge', label: 'RAM Bar (GB)', x: 6, y: 64, width: 123, height: 44, color: '#a855f7' }
      ]
    }
  },
  {
    id: 'pad-01',
    name: '4-Key Matrix',
    type: 'macropad',
    connected: true,
    firmwareVersion: 'v0.1.0-alpha',
    settings: {
      layer: 1,
      rows: 2,
      cols: 2,
      keymap: [
        { id: 0, name: 'SW1', binding: { code: 'M_COPY', label: 'Ctrl + C', category: 'macro', symbol: '📋' } },
        { id: 1, name: 'SW2', binding: { code: 'M_PASTE', label: 'Ctrl + V', category: 'macro', symbol: '📄' } },
        { id: 2, name: 'SW3', binding: { code: 'KC_MUTE', label: 'Mute', category: 'media', symbol: '🔇' } },
        { id: 3, name: 'SW4', binding: { code: 'KC_MPLY', label: 'Play/Pause', category: 'media', symbol: '⏯' } },
      ]
    }
  }
];

export default function App() {
  const [modules, setModules] = useState<ModuleData[]>(INITIAL_MODULES);
  const [selectedId, setSelectedId] = useState<string>('screen-01');
  const [availablePorts, setAvailablePorts] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connected' | 'connecting'>('disconnected');
  const [stats, setStats] = useState<SystemStats>({
    cpu_usage: 0,
    ram_used_gb: 0,
    ram_total_gb: 0,
    ram_percentage: 0,
  });

  // Polling loop for live system telemetry
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await invoke<SystemStats>('get_system_stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to query system telemetry:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic hardware discovery listener
  useEffect(() => {
    const unlistenPromise = listen<any>('node-discovered', (event) => {
      const node = event.payload;

      const newModule: ModuleData = {
        id: `node-${node.assigned_node_id}`,
        name: `${node.device_type === 'Macropad' ? `${node.rows}×${node.cols} Pad` : 'Screen Node'} (#${node.assigned_node_id})`,
        type: node.device_type === 'Macropad' ? 'macropad' : 'screen',
        connected: true,
        firmwareVersion: node.firmware_ver,
        settings: {
          rows: node.rows,
          cols: node.cols,
          keymap: [],
        },
      };

      setModules((prev) => {
        if (prev.some((m) => m.id === newModule.id)) return prev;
        return [...prev, newModule];
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const refreshPorts = async () => {
    try {
      const ports = await invoke<string[]>('list_serial_ports');
      setAvailablePorts(ports);
      if (ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0]);
      }
    } catch (err) {
      console.error('Failed to list serial ports:', err);
    }
  };

  const handleConnectPort = async () => {
    if (!selectedPort) return;
    setConnectionStatus('connecting');
    try {
      await invoke('connect_serial', { portName: selectedPort });
      setConnectionStatus('connected');
    } catch (err) {
      console.error('Failed to connect:', err);
      setConnectionStatus('disconnected');
      alert(`Connection failed: ${err}`);
    }
  };

  useEffect(() => {
    refreshPorts();
  }, []);

  const selectedModule = modules.find((m) => m.id === selectedId);

  const handleNameChange = (newName: string) => {
    setModules((prev) =>
      prev.map((m) => (m.id === selectedId ? { ...m, name: newName } : m))
    );
  };

  const handleBrightnessChange = (brightness: number) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === selectedId
          ? { ...m, settings: { ...m.settings, brightness } }
          : m
      )
    );
  };

  const handleWidgetsChange = (newWidgets: ScreenWidget[]) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === selectedId
          ? { ...m, settings: { ...m.settings, widgets: newWidgets } }
          : m
      )
    );
  };

  return (
    <div className="container">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* USB-CDC Toolbar */}
       {/* USB-CDC Interface Card */}
        <div
          style={{
            background: '#131e33',
            border: '1px solid #1e293b',
            borderRadius: '10px',
            padding: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: connectionStatus === 'connected' ? '#22c55e' : '#64748b',
                  boxShadow: connectionStatus === 'connected' ? '0 0 8px #22c55e' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: '#94a3b8',
                  textTransform: 'uppercase',
                }}
              >
                USB-CDC Serial
              </span>
            </div>

            <button
              type="button"
              onClick={refreshPorts}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#38bdf8',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 6px',
                borderRadius: '4px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#7dd3fc')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#38bdf8')}
            >
              ↻ Refresh
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <select
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
                disabled={connectionStatus === 'connected'}
                style={{
                  width: '100%',
                  background: '#090d16',
                  color: availablePorts.length === 0 ? '#64748b' : '#f8fafc',
                  border: '1px solid #293548',
                  borderRadius: '6px',
                  padding: '0.4rem 0.5rem',
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  cursor: availablePorts.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {availablePorts.length === 0 && (
                  <option value="">No Ports Found</option>
                )}
                {availablePorts.map((port) => (
                  <option key={port} value={port}>
                    {port}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleConnectPort}
              disabled={!selectedPort || connectionStatus === 'connected'}
              style={{
                background:
                  connectionStatus === 'connected'
                    ? '#16a34a'
                    : connectionStatus === 'connecting'
                    ? '#0284c7'
                    : '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.75rem',
                padding: '0.4rem 0.75rem',
                cursor: !selectedPort || connectionStatus === 'connected' ? 'default' : 'pointer',
                opacity: !selectedPort ? 0.5 : 1,
                transition: 'all 0.15s ease-in-out',
                whiteSpace: 'nowrap',
              }}
            >
              {connectionStatus === 'connected'
                ? 'Linked'
                : connectionStatus === 'connecting'
                ? '...'
                : 'Connect'}
            </button>
          </div>
        </div>

        <h2>Connected Modules</h2>
        <div className="module-list">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className={`module-card ${selectedId === mod.id ? 'active' : ''}`}
              onClick={() => setSelectedId(mod.id)}
            >
              <div className="module-header">
                <span
                  className={`status-indicator ${mod.connected ? 'online' : ''}`}
                />
                <h3>{mod.name}</h3>
              </div>
              <p className="module-type">{mod.type.toUpperCase()}</p>
            </div>
          ))}
        </div>

        <button
          style={{
            margin: '1rem',
            padding: '0.6rem 0.8rem',
            background: '#38bdf8',
            color: '#0f172a',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
          onClick={async () => {
            try {
              await invoke('simulate_hardware_plug', {
                deviceType: 3,
                rows: 4,
                cols: 4,
                simulatedUid: Math.floor(Math.random() * 1000000),
              });
            } catch (err) {
              console.error('Plug simulation failed:', err);
            }
          }}
        >
          + Simulate 4×4 Pad Plug
        </button>
      </aside>

      {/* Main Content */}
      <main className="content">
        {selectedModule ? (
          <div className="panel">
            <header className="panel-header">
              <input
                type="text"
                className="name-input"
                value={selectedModule.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              <span className="fw-tag">{selectedModule.firmwareVersion}</span>
            </header>

            <section className="settings-section">
              {selectedModule.type === 'hub' && (
                <div className="config-block">
                  <h4>Hub Diagnostics</h4>
                  <p>
                    CAN Bus: <strong>Active (2 Nodes Online)</strong>
                  </p>
                  <p>
                    Interface: <strong>USB 2.0 Full-Speed</strong>
                  </p>
                </div>
              )}

              {selectedModule.type === 'screen' && (
                <ScreenDesigner
                  brightness={selectedModule.settings?.brightness ?? 100}
                  widgets={selectedModule.settings?.widgets ?? []}
                  stats={stats}
                  onBrightnessChange={handleBrightnessChange}
                  onChange={handleWidgetsChange}
                />
              )}

              {selectedModule.type === 'macropad' && (
                <KeymapEditor
                  rows={selectedModule.settings?.rows ?? 2}
                  cols={selectedModule.settings?.cols ?? 2}
                  keymap={selectedModule.settings?.keymap ?? []}
                  onDimensionChange={(rows, cols) => {
                    setModules((prev) =>
                      prev.map((m) =>
                        m.id === selectedId
                          ? { ...m, settings: { ...m.settings, rows, cols } }
                          : m
                      )
                    );
                  }}
                  onChange={(newKeymap) => {
                    setModules((prev) =>
                      prev.map((m) =>
                        m.id === selectedId
                          ? { ...m, settings: { ...m.settings, keymap: newKeymap } }
                          : m
                      )
                    );
                  }}
                  onKeyRemapped={async (switchIndex, code) => {
                    const rawId = selectedModule.id.replace('node-', '');
                    const targetNodeId = isNaN(Number(rawId)) ? 0x03 : Number(rawId);

                    try {
                      await invoke('send_key_remap', {
                        nodeId: targetNodeId,
                        switchIndex,
                        layer: selectedModule.settings?.layer ?? 0,
                        keycodeStr: code,
                      });
                    } catch (err) {
                      console.error('Failed to send key remap CAN packet:', err);
                    }
                  }}
                />
              )}
            </section>
          </div>
        ) : (
          <div className="empty-state">Select a module to view configuration</div>
        )}
      </main>
    </div>
  );
}