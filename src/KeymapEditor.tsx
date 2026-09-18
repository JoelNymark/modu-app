import { useState } from 'react';
import { KeyBinding, KeySlotConfig } from './types';

interface Props {
  rows?: number;
  cols?: number;
  keymap: KeySlotConfig[];
  onChange: (newKeymap: KeySlotConfig[]) => void;
  onDimensionChange?: (rows: number, cols: number) => void;
  onKeyRemapped?: (switchIndex: number, code: string) => void;
}

const DEFAULT_KEYMAP: KeySlotConfig[] = [
  { id: 0, name: 'SW1', binding: { code: 'M_COPY', label: 'Ctrl + C', category: 'macro', symbol: '📋' } },
  { id: 1, name: 'SW2', binding: { code: 'M_PASTE', label: 'Ctrl + V', category: 'macro', symbol: '📄' } },
  { id: 2, name: 'SW3', binding: { code: 'KC_MUTE', label: 'Mute', category: 'media', symbol: '🔇' } },
  { id: 3, name: 'SW4', binding: { code: 'KC_MPLY', label: 'Play/Pause', category: 'media', symbol: '⏯' } },
];

const BINDING_LIBRARY: Record<string, KeyBinding[]> = {
  letters: [
    { code: 'KC_A', label: 'A', category: 'basic' },
    { code: 'KC_B', label: 'B', category: 'basic' },
    { code: 'KC_C', label: 'C', category: 'basic' },
    { code: 'KC_D', label: 'D', category: 'basic' },
    { code: 'KC_E', label: 'E', category: 'basic' },
    { code: 'KC_F', label: 'F', category: 'basic' },
    { code: 'KC_G', label: 'G', category: 'basic' },
    { code: 'KC_H', label: 'H', category: 'basic' },
    { code: 'KC_I', label: 'I', category: 'basic' },
    { code: 'KC_J', label: 'J', category: 'basic' },
    { code: 'KC_K', label: 'K', category: 'basic' },
    { code: 'KC_L', label: 'L', category: 'basic' },
    { code: 'KC_M', label: 'M', category: 'basic' },
    { code: 'KC_N', label: 'N', category: 'basic' },
    { code: 'KC_O', label: 'O', category: 'basic' },
    { code: 'KC_P', label: 'P', category: 'basic' },
    { code: 'KC_Q', label: 'Q', category: 'basic' },
    { code: 'KC_R', label: 'R', category: 'basic' },
    { code: 'KC_S', label: 'S', category: 'basic' },
    { code: 'KC_T', label: 'T', category: 'basic' },
    { code: 'KC_U', label: 'U', category: 'basic' },
    { code: 'KC_V', label: 'V', category: 'basic' },
    { code: 'KC_W', label: 'W', category: 'basic' },
    { code: 'KC_X', label: 'X', category: 'basic' },
    { code: 'KC_Y', label: 'Y', category: 'basic' },
    { code: 'KC_Z', label: 'Z', category: 'basic' },
  ],
  numbers_symbols: [
    { code: 'KC_1', label: '1 !', category: 'basic' },
    { code: 'KC_2', label: '2 @', category: 'basic' },
    { code: 'KC_3', label: '3 #', category: 'basic' },
    { code: 'KC_4', label: '4 $', category: 'basic' },
    { code: 'KC_5', label: '5 %', category: 'basic' },
    { code: 'KC_6', label: '6 ^', category: 'basic' },
    { code: 'KC_7', label: '7 &', category: 'basic' },
    { code: 'KC_8', label: '8 *', category: 'basic' },
    { code: 'KC_9', label: '9 (', category: 'basic' },
    { code: 'KC_0', label: '0 )', category: 'basic' },
    { code: 'KC_MINS', label: '- _', category: 'basic' },
    { code: 'KC_EQL', label: '= +', category: 'basic' },
    { code: 'KC_LBRC', label: '[ {', category: 'basic' },
    { code: 'KC_RBRC', label: '] }', category: 'basic' },
    { code: 'KC_BSLS', label: '\\ |', category: 'basic' },
    { code: 'KC_SCLN', label: '; :', category: 'basic' },
    { code: 'KC_QUOT', label: '\' "', category: 'basic' },
    { code: 'KC_GRV', label: '` ~', category: 'basic' },
    { code: 'KC_COMM', label: ', <', category: 'basic' },
    { code: 'KC_DOT', label: '. >', category: 'basic' },
    { code: 'KC_SLSH', label: '/ ?', category: 'basic' },
  ],
  modifiers_nav: [
    { code: 'KC_ENT', label: 'Enter', category: 'basic' },
    { code: 'KC_ESC', label: 'Esc', category: 'basic' },
    { code: 'KC_BSPC', label: 'Backspace', category: 'basic' },
    { code: 'KC_TAB', label: 'Tab', category: 'basic' },
    { code: 'KC_SPC', label: 'Space', category: 'basic' },
    { code: 'KC_CAPS', label: 'Caps Lock', category: 'basic' },
    { code: 'KC_LCTL', label: 'Left Ctrl', category: 'basic' },
    { code: 'KC_LSFT', label: 'Left Shift', category: 'basic' },
    { code: 'KC_LALT', label: 'Left Alt', category: 'basic' },
    { code: 'KC_LGUI', label: 'Left Win/Cmd', category: 'basic' },
    { code: 'KC_UP', label: 'Up', category: 'basic', symbol: '↑' },
    { code: 'KC_DOWN', label: 'Down', category: 'basic', symbol: '↓' },
    { code: 'KC_LEFT', label: 'Left', category: 'basic', symbol: '←' },
    { code: 'KC_RGHT', label: 'Right', category: 'basic', symbol: '→' },
    { code: 'KC_DEL', label: 'Delete', category: 'basic' },
    { code: 'KC_HOME', label: 'Home', category: 'basic' },
    { code: 'KC_END', label: 'End', category: 'basic' },
    { code: 'KC_PGUP', label: 'Page Up', category: 'basic' },
    { code: 'KC_PGDN', label: 'Page Down', category: 'basic' },
  ],
  function_keys: [
    { code: 'KC_F1', label: 'F1', category: 'basic' },
    { code: 'KC_F2', label: 'F2', category: 'basic' },
    { code: 'KC_F3', label: 'F3', category: 'basic' },
    { code: 'KC_F4', label: 'F4', category: 'basic' },
    { code: 'KC_F5', label: 'F5', category: 'basic' },
    { code: 'KC_F6', label: 'F6', category: 'basic' },
    { code: 'KC_F7', label: 'F7', category: 'basic' },
    { code: 'KC_F8', label: 'F8', category: 'basic' },
    { code: 'KC_F9', label: 'F9', category: 'basic' },
    { code: 'KC_F10', label: 'F10', category: 'basic' },
    { code: 'KC_F11', label: 'F11', category: 'basic' },
    { code: 'KC_F12', label: 'F12', category: 'basic' },
  ],
  media: [
    { code: 'KC_MUTE', label: 'Mute', category: 'media', symbol: '🔇' },
    { code: 'KC_VOLU', label: 'Vol +', category: 'media', symbol: '🔊' },
    { code: 'KC_VOLD', label: 'Vol -', category: 'media', symbol: '🔉' },
    { code: 'KC_MNXT', label: 'Next Track', category: 'media', symbol: '⏭' },
    { code: 'KC_MPRV', label: 'Prev Track', category: 'media', symbol: '⏮' },
    { code: 'KC_MPLY', label: 'Play/Pause', category: 'media', symbol: '⏯' },
  ],
  macro: [
    { code: 'M_COPY', label: 'Ctrl + C', category: 'macro', symbol: '📋' },
    { code: 'M_PASTE', label: 'Ctrl + V', category: 'macro', symbol: '📄' },
    { code: 'M_UNDO', label: 'Ctrl + Z', category: 'macro', symbol: '↩' },
    { code: 'M_TASK', label: 'Task Mgr', category: 'macro', symbol: '⚙' },
    { code: 'M_DISCORD_MUTE', label: 'Discord Mute', category: 'macro', symbol: '🎙' },
  ],
};

export default function KeymapEditor({
  rows: initialRows = 2,
  cols: initialCols = 2,
  keymap,
  onChange,
  onDimensionChange,
  onKeyRemapped,
}: Props) {
  const [currentRows, setCurrentRows] = useState<number>(initialRows);
  const [currentCols, setCurrentCols] = useState<number>(initialCols);
  const [selectedKeyIdx, setSelectedKeyIdx] = useState<number>(0);
  const [activeCategory, setActiveCategory] = useState<string>('letters'); // Defaults to valid category

  const totalKeys = currentRows * currentCols;

  const activeKeymap: KeySlotConfig[] =
    keymap && keymap.length === totalKeys
      ? keymap
      : totalKeys === 4
      ? DEFAULT_KEYMAP
      : Array.from({ length: totalKeys }, (_, i) => ({
          id: i,
          name: `SW${i + 1}`,
          binding: { code: 'KC_NO', label: 'Unassigned', category: 'basic' as const },
        }));

  const selectedSlot = activeKeymap.find((k) => k.id === selectedKeyIdx) ?? activeKeymap[0];

  const handleSelectBinding = (binding: KeyBinding) => {
    const updated = activeKeymap.map((slot) =>
      slot.id === selectedKeyIdx ? { ...slot, binding } : slot
    );
    onChange(updated);
    onKeyRemapped?.(selectedKeyIdx, binding.code);
  };

  const handleDimensionSelect = (r: number, c: number) => {
    setCurrentRows(r);
    setCurrentCols(c);
    setSelectedKeyIdx(0);
    onDimensionChange?.(r, c);

    const total = r * c;
    const newSlots: KeySlotConfig[] = Array.from({ length: total }, (_, i) => ({
      id: i,
      name: `SW${i + 1}`,
      binding: { code: 'KC_NO', label: 'Unassigned', category: 'basic' as const },
    }));
    onChange(newSlots);
  };

  return (
    <div className="via-editor-root">
      {/* Visual Switch Matrix */}
      <section className="via-matrix-card">
        <div className="via-matrix-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3>{currentRows}×{currentCols} Physical Matrix</h3>
            <select
              value={`${currentRows}x${currentCols}`}
              onChange={(e) => {
                const [r, c] = e.target.value.split('x').map(Number);
                handleDimensionSelect(r, c);
              }}
              style={{
                background: '#0f172a',
                color: '#38bdf8',
                border: '1px solid #334155',
                borderRadius: '4px',
                padding: '0.2rem 0.4rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              <option value="2x2">2×2 (4 Keys)</option>
              <option value="3x3">3×3 (9 Keys)</option>
              <option value="4x4">4×4 (16 Keys)</option>
              <option value="1x4">1×4 (Strip)</option>
            </select>
          </div>

          <span className="selection-badge">
            Editing: <strong>Key {selectedKeyIdx + 1}</strong>
          </span>
        </div>

        <div
          className="via-switch-grid"
          style={{
            gridTemplateColumns: `repeat(${currentCols}, ${currentCols > 3 ? '72px' : '96px'})`,
            gridTemplateRows: `repeat(${currentRows}, ${currentCols > 3 ? '72px' : '96px'})`,
          }}
        >
          {activeKeymap.map((slot) => {
            const isSelected = selectedKeyIdx === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                className={`via-switch ${isSelected ? 'active-switch' : ''}`}
                onClick={() => setSelectedKeyIdx(slot.id)}
              >
                <span className="via-switch-id">SW{slot.id + 1}</span>
                <span className="via-switch-label">
                  {slot.binding?.symbol ? `${slot.binding.symbol} ` : ''}
                  {slot.binding?.label ?? 'None'}
                </span>
                <span className="via-switch-code">{slot.binding?.code ?? 'KC_NO'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* VIA-style Selector Palette */}
      <section className="via-palette-card">
        <div className="via-tabs">
          {[
            { id: 'letters', label: 'A-Z' },
            { id: 'numbers_symbols', label: '0-9 & Symbols' },
            { id: 'modifiers_nav', label: 'Nav & Modifiers' },
            { id: 'function_keys', label: 'F-Keys' },
            { id: 'media', label: 'Media' },
            { id: 'macro', label: 'Shortcuts' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`via-tab-btn ${activeCategory === tab.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="via-binding-options">
          {(BINDING_LIBRARY[activeCategory] ?? []).map((b) => {
            const isBound = selectedSlot?.binding?.code === b.code;
            return (
              <button
                key={b.code}
                type="button"
                className={`via-option-chip ${isBound ? 'bound-option' : ''}`}
                onClick={() => handleSelectBinding(b)}
              >
                {b.symbol && <span className="chip-symbol">{b.symbol}</span>}
                <span className="chip-text">{b.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* CAN Keymap Payload Preview */}
      <section className="via-can-summary">
        <h4>CAN Keymap Payload Preview</h4>
        <div className="can-matrix-dump">
          {activeKeymap.map((slot) => (
            <span key={slot.id} className="can-slot-tag">
              SW{slot.id}: {slot.binding?.code ?? 'KC_NO'} (0x{slot.id.toString(16).padStart(2, '0')})
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}