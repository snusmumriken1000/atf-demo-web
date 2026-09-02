import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { FakeAudioContext } from '$lib/audio/fakeAudioContext';
import { SOUND_STORAGE_KEY } from '$lib/audio/soundPreference';
import { soundState } from '$lib/audio/soundState.svelte';
import { content } from '$lib/data/content';
import SoundToggle from './SoundToggle.svelte';

beforeEach(() => {
	soundState.reset();
	localStorage.clear();
	vi.stubGlobal('AudioContext', FakeAudioContext);
});

const toggle = () => screen.getByRole('button');

describe('SoundToggle', () => {
	it('既定は「押していない」状態で描画される(初回訪問は無音)', () => {
		render(SoundToggle);

		expect(toggle()).toHaveAttribute('aria-pressed', 'false');
		expect(soundState.enabled).toBe(false);
	});

	it('見えているラベルと操作の説明の両方が読み上げ名に含まれる', () => {
		render(SoundToggle);

		expect(toggle()).toHaveAccessibleName(
			new RegExp(`${content.audio.label}.*${content.audio.enableLabel}`)
		);
	});

	it('ヘッドホン推奨の補足を表示する', () => {
		render(SoundToggle);

		expect(screen.getByText(content.audio.hint)).toBeInTheDocument();
	});

	it('押すと音が有効になり、説明が「停止する」に切り替わる', async () => {
		render(SoundToggle);
		toggle().click();
		await vi.waitFor(() => expect(toggle()).toHaveAttribute('aria-pressed', 'true'));

		expect(soundState.enabled).toBe(true);
		expect(toggle()).toHaveAccessibleName(new RegExp(content.audio.disableLabel));
	});

	it('もう一度押すと無音に戻る', async () => {
		render(SoundToggle);
		toggle().click();
		await vi.waitFor(() => expect(soundState.enabled).toBe(true));
		toggle().click();
		await vi.waitFor(() => expect(soundState.enabled).toBe(false));

		expect(toggle()).toHaveAttribute('aria-pressed', 'false');
	});

	it('選択を localStorage に保存する', async () => {
		render(SoundToggle);
		toggle().click();

		await vi.waitFor(() => expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('on'));
	});

	it('前回オンにしていた場合は押された状態で復元する', async () => {
		localStorage.setItem(SOUND_STORAGE_KEY, 'on');
		render(SoundToggle);

		await vi.waitFor(() => expect(toggle()).toHaveAttribute('aria-pressed', 'true'));
	});

	it('AudioContext を持たないブラウザでは何も描画しない(段階的強化)', () => {
		vi.stubGlobal('AudioContext', undefined);
		render(SoundToggle);

		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
