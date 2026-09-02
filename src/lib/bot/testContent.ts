/*
 * テスト専用のコンテンツ雛形(アプリからは import しない)。
 *
 * ボットの挙動は content.ts に何が書いてあるかで決まるため、テストでは
 * 実物ではなくこの最小コンテンツを使い、「この内容ならこう答える」を固定する。
 * 実物の content.ts に依存しないので、文言を差し替えてもテストは壊れない。
 */

import type { SiteContent } from '$lib/data/content.types';

export const testContent = (): SiteContent => ({
	site: {
		title: 'テストサイト',
		entryLead: '3 つの面をもつサイトです。',
		faces: {
			showcase: { label: 'Showcase', lead: 'ビジュアルの面。' },
			profile: { label: 'Profile', lead: '読む面。' },
			ask: { label: 'Ask', lead: '聞く面。' }
		},
		navigation: {
			top: 'Top',
			switcherLabel: '面の切り替え',
			entryLabel: '面の選択',
			skipToContent: '本文へスキップ',
			scrollHint: 'Scroll'
		}
	},
	hero: { name: 'テスト太郎', statement: '静かな\nコード', worksLabel: 'Works' },
	profile: {
		sectionLabels: {
			about: 'About',
			career: '経歴',
			skills: 'スキル',
			works: '作品',
			links: 'リンク'
		},
		workMetaLabels: { role: 'Role', period: 'Year', tech: 'Stack' },
		intro: ['フロントエンドのエンジニアです。'],
		career: [
			{
				period: '2022 — 現在',
				title: 'フロントエンドエンジニア',
				org: 'テスト株式会社',
				summary: 'デザインシステムの整備を主導しました。'
			},
			{ period: '2019 — 2022', title: 'Web エンジニア', org: 'サンプル工房' }
		],
		skills: [
			{
				label: 'フロントエンド',
				items: [{ name: 'TypeScript', note: '業務で 4 年' }, { name: 'Svelte' }]
			},
			{ label: 'ツール', items: [{ name: 'Vitest' }] }
		],
		links: [{ label: 'GitHub', url: 'https://github.com/example' }]
	},
	works: [
		{
			id: 'sound-garden',
			title: 'Sound Garden',
			blurb: '音で遊ぶ実験的なサイト',
			hue: 200,
			description: ['Web Audio API だけで音を合成する試みです。'],
			role: '設計・実装',
			tech: ['Svelte', 'Web Audio'],
			period: '2026',
			links: [{ label: 'GitHub', url: 'https://github.com/example/sound-garden' }]
		},
		{ id: 'paper-notes', title: 'Paper Notes', blurb: '紙のようなメモ帳', hue: 40 }
	],
	audio: {
		label: 'Sound',
		enableLabel: '再生',
		disableLabel: '停止',
		hint: 'ヘッドホン推奨',
		volume: 0.5,
		bpm: 74,
		baseHz: 130.81,
		octaveRange: 2
	},
	ask: {
		greeting: 'こんにちは。',
		notice: '外部の AI は使っていません。',
		inputLabel: '質問を入力',
		placeholder: '質問をどうぞ',
		sendLabel: '送信',
		suggestions: ['どんな作品がありますか?', '経歴を教えてください'],
		fallback: 'お答えできません。',
		sourceLabel: 'この内容がある場所',
		botName: 'モク',
		userName: 'You',
		companionAlt: '丸くて白い生き物。',
		leads: {
			greeting: 'こんにちは。何を知りたいですか。',
			help: '答えられるのは次の内容です。',
			about: 'こんな人です。',
			career: 'これまでの経歴です。',
			skill: '使える技術です。',
			work: '手がけた作品です。',
			link: 'リンクです。',
			site: 'このサイトについてです。',
			general: '近いのはこのあたりです。'
		}
	}
});
