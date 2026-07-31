/*
 * 面 1(/showcase)に並べる作品データ。#4 の作品詳細と将来共有する。
 * 現状はプレースホルダ。実作品が決まったらこの配列を差し替えるだけでよい。
 */
export type Work = {
	/** 作品名(欧文はディスプレイフォントで表示される) */
	title: string;
	/** 一行説明 */
	blurb: string;
	/** プレースホルダビジュアル(CSS グラデーション)の色相(0〜360) */
	hue: number;
	/**
	 * 作品ページ・外部リンク(任意)。指定するとタイル全体がリンクになる。
	 * 内部パスは $app/paths の resolve() を通した値を入れること(外部 URL はそのまま)。
	 */
	href?: string;
};

export const works: Work[] = [
	{
		title: 'Two-Faced Portfolio',
		blurb: '2 つの面をもつこのポートフォリオサイト自体',
		hue: 215
	},
	{
		title: 'Quiet Components',
		blurb: 'ダーク基調のミニマルな UI コンポーネント試作',
		hue: 265
	},
	{
		title: 'Static Guardrail',
		blurb: '外部参照を検出する静的サイト検証スクリプト',
		hue: 160
	},
	{
		title: 'Type Playground',
		blurb: 'タイポグラフィとモーションの実験場',
		hue: 20
	}
];
