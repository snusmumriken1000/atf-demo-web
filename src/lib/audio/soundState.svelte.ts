/*
 * 「音が有効か」を持つだけの共有状態(rune)。
 *
 * トグル(SoundToggle)と音場(SpatialAudioScene)は別々の場所に描画されるため、
 * 両者をつなぐ最小の状態をここに置く。音の生成そのものには関与しない。
 *
 * 面 2(profile)へ移動すると SpatialAudioScene が破棄されて音は止まる。
 * この状態(= ユーザーの意思)は保持したままなので、面 1 に戻ると再開する。
 */

import { readStoredPreference, safeLocalStorage, writeStoredPreference } from './soundPreference';

let enabled = $state(false);
let hydrated = $state(false);

export const soundState = {
	/** 音を鳴らす設定か */
	get enabled() {
		return enabled;
	},
	/** 保存済み設定の読み出しが済んだか(SSR / 初期描画との差を避けるために見る) */
	get hydrated() {
		return hydrated;
	},
	set(next: boolean) {
		enabled = next;
		writeStoredPreference(safeLocalStorage(), next);
	},
	toggle() {
		this.set(!enabled);
	},
	/** クライアントでのみ呼ぶ。保存済みの設定を復元する */
	hydrate() {
		if (hydrated) return;
		enabled = readStoredPreference(safeLocalStorage());
		hydrated = true;
	},
	/** テスト用。状態を初期化する */
	reset() {
		enabled = false;
		hydrated = false;
	}
};
