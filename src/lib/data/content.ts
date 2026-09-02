/*
 * ============================================================
 * サイトに表示する文言は、すべてこのファイルにまとまっています。
 * このファイルだけを編集すれば、サイト全体に反映されます。
 * ============================================================
 *
 * 【編集のしかた】
 * - 引用符 '...' の中の文字を書き換えてください
 * - 任意の項目(intro / links / role / tech / period / description /
 *   org / summary / note / featured)は、不要なら行ごと削除できます
 * - 経歴・スキル・作品を増減するときは、{ ... }, のかたまりごと
 *   コピー / 削除してください(並び順 = 表示順)
 * - 画像などのアセットに外部 URL は使えません(リポジトリに同梱する方針)。
 *   外部サイトへのリンク(links の url)は https:// で書けます
 *
 * 【編集後の確認】
 * - npm run check  … 書き間違い(必須項目の消し忘れ等)を行番号付きで検出
 * - npm run verify … サイト全体の検証を一括実行
 *
 * ※ 現在の内容はサンプルです。実際の文言に差し替えてください。
 */
import type { SiteContent } from './content.types';
import { validateContent } from './content.validation';

export const content: SiteContent = {
	// ---- サイト全体(タブの表示・入口ページ) ----
	site: {
		title: 'atf-demo-web',
		entryLead: '3 つの面をもつポートフォリオサイト。見たい面を選んでください。',
		faces: {
			showcase: {
				label: 'Showcase',
				lead: '静かなコードで、鮮やかなものをつくる面。'
			},
			profile: {
				label: 'Profile',
				lead: '経歴・スキル・作品を落ち着いて読める面。'
			},
			ask: {
				label: 'Ask',
				lead: 'このサイトの内容について、聞いて確かめられる面。'
			}
		},
		navigation: {
			top: 'Top',
			switcherLabel: '面の切り替え',
			entryLabel: '面の選択',
			skipToContent: '本文へスキップ',
			scrollHint: 'Scroll ↓'
		}
	},

	// ---- 名前とステートメント(showcase のヒーロー / profile のヘッダー) ----
	hero: {
		name: 'Sample Sato', // サンプル名。実名やハンドルネームに差し替える
		statement: 'Quiet code,\nvivid work.',
		worksLabel: 'Works'
	},

	// ---- 面 2(profile)の自己紹介・経歴・スキル ----
	profile: {
		sectionLabels: {
			about: 'About',
			career: '経歴',
			skills: 'スキル',
			works: '作品',
			links: 'リンク'
		},
		workMetaLabels: {
			role: 'Role',
			period: 'Year',
			tech: 'Stack'
		},
		intro: [
			'Web フロントエンドを中心に、設計から実装・検証までを一貫して担当しているエンジニアです。',
			'派手さよりも、静かに長く使えるものを丁寧につくることを大切にしています。'
		],
		career: [
			{
				period: '2022 — 現在',
				title: 'フロントエンドエンジニア',
				org: 'Example Inc.',
				summary:
					'自社サービスの Web フロントエンドを設計から実装まで担当。デザインシステムの整備を主導。'
			},
			{
				period: '2019 — 2022',
				title: 'Web エンジニア',
				org: 'Sample Studio',
				summary: '受託開発で中小規模の Web サイト構築を多数担当。'
			},
			{
				// org / summary を省いた最小の書き方の例
				period: '2015 — 2019',
				title: '情報工学専攻(学士)',
				org: 'サンプル大学'
			}
		],
		skills: [
			{
				label: 'フロントエンド',
				items: [
					{ name: 'TypeScript', note: '業務で 4 年' },
					{ name: 'Svelte / SvelteKit' },
					{ name: 'HTML / CSS', note: 'アクセシビリティ対応を含む' }
				]
			},
			{
				label: 'ツール・その他',
				items: [{ name: 'Node.js' }, { name: 'Vitest' }, { name: 'GitHub Actions' }]
			},
			{
				label: 'デザイン',
				items: [{ name: 'Figma', note: '実装者としての利用が中心' }]
			}
		],
		links: [{ label: 'GitHub', url: 'https://github.com/example' }]
	},

	// ---- 作品一覧(showcase のタイルと profile の詳細で共有) ----
	works: [
		{
			id: 'two-faced-portfolio',
			title: 'Two-Faced Portfolio',
			blurb: '2 つの面をもつこのポートフォリオサイト自体',
			hue: 215,
			featured: true,
			role: '設計・実装',
			tech: ['SvelteKit', 'TypeScript'],
			period: '2026',
			description: [
				'ビジュアル特化の面と情報整理の面という 2 つの顔をもつ、静的出力のポートフォリオサイト。',
				'外部リソースを一切読み込まない自己完結の構成で、文言はすべて単一のコンテンツファイルから差し替えられる。'
			],
			links: [{ label: 'GitHub', url: 'https://github.com/example/two-faced-portfolio' }]
		},
		{
			id: 'quiet-components',
			title: 'Quiet Components',
			blurb: 'ダーク基調のミニマルな UI コンポーネント試作',
			hue: 265,
			featured: true,
			role: 'デザイン・実装',
			tech: ['Svelte', 'CSS'],
			period: '2025',
			description: ['装飾を線と余白だけに絞った、ダークテーマ前提の UI コンポーネント集の試作。']
		},
		{
			id: 'static-guardrail',
			title: 'Static Guardrail',
			blurb: '外部参照を検出する静的サイト検証スクリプト',
			hue: 160,
			featured: true,
			tech: ['Node.js'],
			period: '2025',
			description: [
				'ビルド成果物を走査して外部 URL 参照を default-deny で検出する、依存ゼロの検証スクリプト。'
			]
		},
		{
			// 必須項目(id / title / blurb / hue)だけの最小の書き方の例
			id: 'type-playground',
			title: 'Type Playground',
			blurb: 'タイポグラフィとモーションの実験場',
			hue: 20,
			featured: true
		}
	],

	// ---- 面 3(ask)の対話 ----
	// ボットは下の profile / works に書いたことだけを答えます。回答の中身は
	// そこから自動で引かれるので、ここには前置きと案内の文だけを書きます。
	ask: {
		greeting:
			'こんにちは。このポートフォリオについてお答えします。経歴・スキル・作品のことなら聞いてみてください。',
		notice:
			'このボットは外部の AI を使わず、このサイトの内容(content.ts)を検索して答えています。書かれていないことには答えられません。',
		inputLabel: '質問を入力',
		placeholder: 'どんな作品がありますか?',
		sendLabel: '送信',
		suggestions: [
			'どんな作品がありますか?',
			'経歴を教えてください',
			'使える技術は?',
			'このサイトについて教えて'
		],
		fallback:
			'そのご質問には、このサイトに書かれている内容からはお答えできません。次のようなことならお答えできます。',
		sourceLabel: 'この内容がある場所',
		botName: 'モク', // 面 3 で話し相手になる生き物の名前
		userName: 'You',
		companionAlt:
			'丸くて白い、無機質だけれど親しみのある生き物。頭の上に小さな灯りがともっている。',
		leads: {
			greeting: 'こんにちは。経歴・スキル・作品について、書かれていることをお答えします。',
			help: 'お答えできるのは、このサイトに書かれている次のような内容です。',
			about: 'こんな人です。',
			career: 'これまでの経歴です。',
			skill: '使える技術はこのあたりです。',
			work: '手がけた作品です。',
			link: '外部のリンクはこちらです。',
			site: 'このサイトについてです。',
			general: '近いのはこのあたりです。'
		}
	},

	// ---- 面 1(showcase)の空間オーディオ ----
	// 音は音声ファイルではなくブラウザ内で合成しています。ここの数値を変えると
	// 鳴る曲そのものが変わります(音源ファイルの用意は不要)。
	// リズムとコード進行は 4 小節ループで、メロディの高さは各作品の hue(色相)から
	// 自動で決まります(その小節のコードに溶ける音へ寄せます)。
	audio: {
		label: 'Sound',
		enableLabel: '空間オーディオを再生する',
		disableLabel: '空間オーディオを停止する',
		hint: 'ヘッドホン推奨',
		volume: 0.5, // 0(無音)〜 1(最大)
		bpm: 74, // テンポ。チルな速さは 65〜85 あたり
		baseHz: 130.81, // 主音の高さ(C3)。曲全体の調が決まる
		octaveRange: 2 // メロディが広がる音域(オクターブ数)
	}
};

validateContent(content);
