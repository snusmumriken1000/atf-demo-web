import type { Attachment } from 'svelte/attachments';

/*
 * スクロール出現(フェードイン)の attachment。`<li {@attach fadeInOnView()}>` のように使う。
 *
 * 見た目の状態クラス(.fade-target / .fade-pending)は global.css に定義してある。
 * 順序の規約: 既定(SSR / JS 無効)は可視 → JS 実行後にだけ hidden(.fade-pending)を
 * 付けて observe → 交差で外してフェードイン。JS 無効環境でコンテンツが不可視に
 * ならないよう、この順序を崩してはならない。
 */
export function fadeInOnView(): Attachment<Element> {
	return (element) => {
		// reduced-motion 時は何もしない(常に可視のまま)
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		element.classList.add('fade-target', 'fade-pending');

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					// クラスを外すと .fade-target の transition でフェードインする
					entry.target.classList.remove('fade-pending');
					observer.unobserve(entry.target);
				}
			},
			// タイルの下端が少し見えてから出現させる
			{ threshold: 0.15 }
		);
		observer.observe(element);

		return () => {
			observer.disconnect();
			element.classList.remove('fade-target', 'fade-pending');
		};
	};
}
