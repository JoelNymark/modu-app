export type ModuleType = 'hub' | 'screen' | 'macropad';

export type WidgetType = 'clock' | 'cpu_gauge' | 'ram_gauge' | 'label' | 'media';

export interface ScreenWidget {
    id: string;
    type: WidgetType;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

export interface ModuleData {
    id: string;
    name: string;
    type: ModuleType;
    connected: boolean;
    firmwareVersion: string;
    settings?: {
        brightness?: number;
        activeLayout?: string;
        widgets?: ScreenWidget[];
        layer?: number;
        rows?: number;
        cols?: number;
        keymap?: KeySlotConfig[];
    };
}


export type KeyCategory = 'basic' | 'media' | 'macro';

export interface KeyBinding {
  code: string;
  label: string;
  category: KeyCategory;
  symbol?: string;
}

export interface KeySlotConfig {
  id: number;      // 0 to 3 for our 2x2 matrix
  name: string;    // e.g. "Key 1"
  binding: KeyBinding;
}