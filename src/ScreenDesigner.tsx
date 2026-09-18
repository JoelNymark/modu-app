import { useState } from 'react';
import { ScreenWidget, WidgetType } from './types';

interface Props {
  widgets: ScreenWidget[];
  brightness: number;
  stats?: SystemStats;
  onChange: (widgets: ScreenWidget[]) => void;
  onBrightnessChange: (val: number) => void;
}

const AVAILABLE_WIDGETS: { type: WidgetType; label: string; defaultH: number; defaultColor: string }[] = [
    { type: 'clock', label: 'Digital Clock', defaultH: 36, defaultColor: '#38bdf8' },
    { type: 'cpu_gauge', label: 'CPU Meter (%)', defaultH: 48, defaultColor: '#ef4444' },
    { type: 'ram_gauge', label: 'RAM Bar (GB)', defaultH: 44, defaultColor: '#a855f7' },
    { type: 'media', label: 'Now Playing', defaultH: 42, defaultColor: '#22c55e' },
    { type: 'label', label: 'Custom Label', defaultH: 28, defaultColor: '#f59e0b' },
];

export default function ScreenDesigner({
  widgets,
  brightness,
  stats,
  onChange,
  onBrightnessChange,
}: Props) {
    const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(widgets[0]?.id ?? null);

    const selectedWidget = widgets.find((w) => w.id === selectedWidgetId);

    const addWidget = (item: typeof AVAILABLE_WIDGETS[0]) => {
        // Stack underneath existing items
        const lastY = widgets.reduce((max, w) => Math.max(max, w.y + w.height), 8);
        const newWidget: ScreenWidget = {
            id: `w-${Date.now()}`,
            type: item.type,
            label: item.label,
            x: 6,
            y: Math.min(lastY + 4, 230 - item.defaultH),
            width: 123, // Fits comfortably in 135px width
            height: item.defaultH,
            color: item.defaultColor,
        };
        const updated = [...widgets, newWidget];
        onChange(updated);
        setSelectedWidgetId(newWidget.id);
    };

    const removeWidget = (id: string) => {
        const updated = widgets.filter((w) => w.id !== id);
        onChange(updated);
        if (selectedWidgetId === id) setSelectedWidgetId(updated[0]?.id ?? null);
    };

    const updateSelected = (updates: Partial<ScreenWidget>) => {
        if (!selectedWidgetId) return;
        onChange(
            widgets.map((w) => (w.id === selectedWidgetId ? { ...w, ...updates } : w))
        );
    };

    // Generates preview packets (Command ID, Target, Payload length, Bytes)
    const getSerialPayloadPreview = () => {
        return widgets.map((w, idx) => {
            const typeCode = { clock: 0x01, cpu_gauge: 0x02, ram_gauge: 0x03, media: 0x04, label: 0x05 }[w.type];
            return `[CAN CMD 0x20] Widget #${idx + 1} -> Type: 0x0${typeCode}, X: ${w.x}, Y: ${w.y}, W: ${w.width}, H: ${w.height}`;
        });
    };

    return (
        <div className="designer-root">
            {/* Visual Canvas Simulator */}
            <div className="canvas-wrapper">
                <div className="screen-bezel">
                    <div
                        className="screen-viewport"
                        style={{ opacity: brightness / 100 }}
                    >
                        {widgets.map((w) => {
                            const isSelected = w.id === selectedWidgetId;
                            return (
                                <div
                                    key={w.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedWidgetId(w.id);
                                    }}
                                    className={`canvas-widget ${isSelected ? 'selected' : ''}`}
                                    style={{
                                        left: `${w.x}px`,
                                        top: `${w.y}px`,
                                        width: `${w.width}px`,
                                        height: `${w.height}px`,
                                        borderColor: isSelected ? '#ffffff' : w.color,
                                    }}
                                >
                                    <span className="widget-chip" style={{ color: w.color }}>
                                        {w.type === 'clock' && '12:44:00'}
                                        {w.type === 'cpu_gauge' && `CPU: ${Math.round(stats?.cpu_usage ?? 0)}%`}
                                        {w.type === 'ram_gauge' && `RAM: ${stats?.ram_used_gb ?? 0}/${stats?.ram_total_gb ?? 0}G (${stats?.ram_percentage ?? 0}%)`}
                                        {w.type === 'media' && '♫ Bohemian Rhapsody'}
                                        {w.type === 'label' && w.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <span className="dimension-badge">135 × 240 IPS TFT</span>
            </div>

            {/* Editor & Controls */}
            <div className="designer-sidebar">
                <section className="designer-section">
                    <h4>Backlight</h4>
                    <div className="slider-row">
                        <input
                            type="range"
                            min="10"
                            max="100"
                            value={brightness}
                            onChange={(e) => onBrightnessChange(Number(e.target.value))}
                        />
                        <span>{brightness}%</span>
                    </div>
                </section>

                <section className="designer-section">
                    <h4>Available Widgets</h4>
                    <div className="widget-button-grid">
                        {AVAILABLE_WIDGETS.map((item) => (
                            <button
                                key={item.type}
                                className="add-widget-btn"
                                onClick={() => addWidget(item)}
                            >
                                + {item.label}
                            </button>
                        ))}
                    </div>
                </section>

                {selectedWidget && (
                    <section className="designer-section widget-inspector">
                        <div className="section-head">
                            <h4>Widget Inspector</h4>
                            <button
                                className="btn-delete"
                                onClick={() => removeWidget(selectedWidget.id)}
                            >
                                Remove
                            </button>
                        </div>

                        <label>Label</label>
                        <input
                            type="text"
                            value={selectedWidget.label}
                            onChange={(e) => updateSelected({ label: e.target.value })}
                        />

                        <div className="coord-grid">
                            <div>
                                <label>Pos Y</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="200"
                                    value={selectedWidget.y}
                                    onChange={(e) => updateSelected({ y: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label>Height</label>
                                <input
                                    type="number"
                                    min="16"
                                    max="100"
                                    value={selectedWidget.height}
                                    onChange={(e) => updateSelected({ height: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        <label>Accent Color</label>
                        <input
                            type="color"
                            value={selectedWidget.color}
                            onChange={(e) => updateSelected({ color: e.target.value })}
                        />
                    </section>
                )}

                <section className="designer-section">
                    <h4>CAN Serial Stream (Preview)</h4>
                    <pre className="packet-preview">
                        {getSerialPayloadPreview().join('\n') || '// No widgets placed'}
                    </pre>
                </section>
            </div>
        </div>
    );
}