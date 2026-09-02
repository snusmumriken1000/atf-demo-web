import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import AskCompanion from './AskCompanion.svelte';

const props = {
	name: 'モク',
	description: '丸くて白い生き物。'
};

describe('AskCompanion', () => {
	it('名前と見た目の説明を読み上げられる形で持つ', () => {
		render(AskCompanion, { props });

		const figure = screen.getByRole('img', { name: /モク/ });
		expect(figure).toHaveAccessibleDescription('丸くて白い生き物。');
	});

	it('既定では静かにしている', () => {
		const { container } = render(AskCompanion, { props });
		expect(container.querySelector('.companion')).toHaveAttribute('data-state', 'idle');
	});

	it('答えているあいだは反応の状態になる', () => {
		const { container } = render(AskCompanion, {
			props: { ...props, state: 'talking' as const }
		});
		expect(container.querySelector('.companion')).toHaveAttribute('data-state', 'talking');
	});

	it('画像ファイルを読み込まずに描く(外部リソース非依存)', () => {
		const { container } = render(AskCompanion, { props });

		expect(container.querySelector('svg')).toBeInTheDocument();
		expect(container.querySelector('img')).not.toBeInTheDocument();
	});
});
