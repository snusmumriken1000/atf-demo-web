import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { content } from '$lib/data/content';
import AskPage from './+page.svelte';

const log = () => screen.getByRole('log');
const input = () => screen.getByLabelText(content.ask.inputLabel);

/** 入力欄に打ち込んでフォームを送信する(Enter でも送信ボタンでも同じ経路) */
async function askQuestion(container: HTMLElement, question: string) {
	await fireEvent.input(input(), { target: { value: question } });
	const form = container.querySelector('form');
	if (!form) throw new Error('入力フォームが見つかりません');
	await fireEvent.submit(form);
}

describe('面 3(ask)', () => {
	it('話し相手の生き物を出す', () => {
		render(AskPage);

		expect(screen.getByRole('img', { name: content.ask.botName })).toBeInTheDocument();
	});

	it('ボットの挨拶と仕組みの注記を最初に出す', () => {
		render(AskPage);

		expect(within(log()).getByText(content.ask.greeting)).toBeInTheDocument();
		expect(screen.getByText(content.ask.notice)).toBeInTheDocument();
	});

	it('質問例をボタンとして出す(キーボードだけで会話を始められる)', () => {
		render(AskPage);

		for (const suggestion of content.ask.suggestions) {
			expect(screen.getByRole('button', { name: suggestion })).toBeInTheDocument();
		}
	});

	it('会話ログは新着だけを読み上げる', () => {
		render(AskPage);
		expect(log()).toHaveAttribute('aria-live', 'polite');
	});

	it('質問を送ると、質問と回答がログに並ぶ', async () => {
		const { container } = render(AskPage);

		await askQuestion(container, '経歴を教えてください');

		expect(within(log()).getByText('経歴を教えてください')).toBeInTheDocument();
		expect(within(log()).getByText(content.ask.leads.career)).toBeInTheDocument();
	});

	it('質問例を押すだけでも会話できる', async () => {
		render(AskPage);

		await fireEvent.click(screen.getByRole('button', { name: 'どんな作品がありますか?' }));

		expect(within(log()).getByText(content.ask.leads.work)).toBeInTheDocument();
	});

	it('回答には content.ts の内容と、その内容がある場所へのリンクが載る', async () => {
		render(AskPage);

		await fireEvent.click(screen.getByRole('button', { name: 'どんな作品がありますか?' }));

		const [work] = content.works;
		expect(within(log()).getByText(work.title)).toBeInTheDocument();
		expect(
			within(log()).getAllByRole('link', { name: content.profile.sectionLabels.works })[0]
		).toHaveAttribute('href', `/profile#work-${work.id}`);
	});

	it('答えられない質問には、答えられる範囲を示して返す', async () => {
		const { container } = render(AskPage);

		await askQuestion(container, '明日の天気を教えて');

		expect(within(log()).getByText(content.ask.fallback)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: content.ask.suggestions[0] })).toBeInTheDocument();
	});

	it('送信後に入力欄が空になる', async () => {
		const { container } = render(AskPage);

		await askQuestion(container, '作品は?');

		expect(input()).toHaveValue('');
	});

	it('空欄では送信できない', () => {
		render(AskPage);
		expect(screen.getByRole('button', { name: content.ask.sendLabel })).toBeDisabled();
	});

	it('空白だけを送っても発言が増えない', async () => {
		const { container } = render(AskPage);
		const before = within(log()).getAllByRole('listitem').length;

		await askQuestion(container, '   ');

		expect(within(log()).getAllByRole('listitem')).toHaveLength(before);
	});
});
