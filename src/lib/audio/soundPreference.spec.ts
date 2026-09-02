import { describe, expect, it } from 'vitest';
import { readStoredPreference, SOUND_STORAGE_KEY, writeStoredPreference } from './soundPreference';

/** localStorage の最小スタブ。throws: true で例外を投げる環境を再現する */
const fakeStorage = (initial: Record<string, string> = {}, throws = false) => {
	const store = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => {
			if (throws) throw new Error('storage is not available');
			return store.get(key) ?? null;
		},
		setItem: (key: string, value: string) => {
			if (throws) throw new Error('storage is not available');
			store.set(key, value);
		},
		read: (key: string) => store.get(key) ?? null
	} as unknown as Storage & { read: (key: string) => string | null };
};

describe('readStoredPreference', () => {
	it('保存がなければ無音(false)から始まる', () => {
		expect(readStoredPreference(fakeStorage())).toBe(false);
	});

	it('前回オンにしていれば true を返す', () => {
		expect(readStoredPreference(fakeStorage({ [SOUND_STORAGE_KEY]: 'on' }))).toBe(true);
	});

	it('オフや不正な値はすべて false に倒す', () => {
		expect(readStoredPreference(fakeStorage({ [SOUND_STORAGE_KEY]: 'off' }))).toBe(false);
		expect(readStoredPreference(fakeStorage({ [SOUND_STORAGE_KEY]: 'yes' }))).toBe(false);
	});

	it('localStorage が使えない環境でも例外を投げず false を返す', () => {
		expect(readStoredPreference(null)).toBe(false);
		expect(readStoredPreference(fakeStorage({}, true))).toBe(false);
	});
});

describe('writeStoredPreference', () => {
	it('オン / オフを保存する', () => {
		const storage = fakeStorage();
		writeStoredPreference(storage, true);
		expect(storage.read(SOUND_STORAGE_KEY)).toBe('on');

		writeStoredPreference(storage, false);
		expect(storage.read(SOUND_STORAGE_KEY)).toBe('off');
	});

	it('書き込めない環境でも例外を投げない(その場の再生は続く)', () => {
		expect(() => {
			writeStoredPreference(null, true);
			writeStoredPreference(fakeStorage({}, true), true);
		}).not.toThrow();
	});
});
