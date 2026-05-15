import type { RegisterableHotkey } from '@tanstack/svelte-hotkeys';

//todo obsidian hotkey 設定
// 或許不用自己綁定 hotkey ，直接用 obsidian 的 commad 設定？
// 常見的單鍵
export const COMMON_KEY = {
    ENTER: "Enter",
    ESCAPE: "Escape",
    TAB: "Tab",
    BACKSPACE: "Backspace",
    DELETE: "Delete",
    MOVE_UP: "ArrowUp",
    MOVE_DOWN: "ArrowDown",
    MOVE_LEFT: "ArrowLeft",
    MOVE_RIGHT: "ArrowRight",
    HOME: "Home",
    END: "End",
    PAGE_UP: "PageUp",
    PAGE_DOWN: "PageDown",
    LOCK_TO_CENTER: "Control+Shift+K",
} as const;

export const {
    ENTER,
    ESCAPE,
    TAB,
    BACKSPACE,
    DELETE,
    MOVE_UP,
    MOVE_DOWN,
    MOVE_LEFT,
    MOVE_RIGHT,
    HOME,
    END,
    PAGE_UP,
    PAGE_DOWN,
    LOCK_TO_CENTER,
} = COMMON_KEY;

export type KeyLogic = keyof typeof COMMON_KEY;
export type CommonKeys = (typeof COMMON_KEY)[keyof typeof COMMON_KEY];

// 修飾鍵
export const MODIFIER_KEY = {
    CTRL: "Control",
    SHIFT: "Shift",
    ALT: "Alt",
    META: "Meta",
} as const;

export const { CTRL, SHIFT, ALT, META } = MODIFIER_KEY;

export type ModifierKey = (typeof MODIFIER_KEY)[keyof typeof MODIFIER_KEY];
export const MODIFIER_KEYS = Object.values(MODIFIER_KEY) as readonly ModifierKey[];

// 組合鍵
export function createKeyCombo<T extends (ModifierKey | KeyLogic)[]>(...keys: T): string {
    return keys.join("+");
}

export const KEY_COMBO = {
    SHIFT_TAB: `${SHIFT}+${TAB}`,
    CTRL_SHIFT_TAB: `${CTRL}+${SHIFT}+${TAB}`,
} as const;

export const { SHIFT_TAB, CTRL_SHIFT_TAB } = KEY_COMBO;

export type KeyCombo = (typeof KEY_COMBO)[keyof typeof KEY_COMBO];
export const KEY_COMBOS = Object.values(KEY_COMBO) as readonly KeyCombo[];

export type ShortcutKey = KeyLogic | KeyCombo;

export type ShortcutAction = {
    [K in ShortcutKey]?: ShortCut;
};

export type ShortCut = {
    hotkey: CommonKeys | KeyCombo;
    callback: () => void;
};



