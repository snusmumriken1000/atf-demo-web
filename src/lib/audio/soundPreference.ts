/*
 * 音を鳴らすかどうかの設定の読み書き(localStorage)。
 *
 * localStorage は Safari のプライベートモードや設定次第で参照・書き込みが
 * 例外を投げるため、失敗しても機能全体が壊れないよう握りつぶして既定値に倒す。
 * 保存されているのは真偽値 1 つだけで、外部への送信は一切しない。
 */

export const SOUND_STORAGE_KEY = 'atf-demo-web:spatial-audio';

const ENABLED = 'on';
const DISABLED = 'off';

/** 参照可能なら localStorage を返す。使えない環境では null */
export function safeLocalStorage(): Storage | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

/**
 * 保存済みの設定を読む。未保存 / 不正値 / 例外はすべて false(無音)。
 * 初回訪問が必ず無音から始まるのはこの既定値による。
 */
export function readStoredPreference(storage: Storage | null): boolean {
	if (!storage) return false;
	try {
		return storage.getItem(SOUND_STORAGE_KEY) === ENABLED;
	} catch {
		return false;
	}
}

/** 設定を保存する。書けない環境では黙って諦める(その場の再生は続く) */
export function writeStoredPreference(storage: Storage | null, enabled: boolean): void {
	if (!storage) return;
	try {
		storage.setItem(SOUND_STORAGE_KEY, enabled ? ENABLED : DISABLED);
	} catch {
		// 保存できなくても再生自体には影響しない
	}
}
