/*
 * サイトコンテンツ(content.ts)の型定義。
 *
 * このファイルは編集不要。サイトの文言を変えるときは content.ts だけを編集する。
 * 必須 / 任意(`?` 付き)の区分やフィールド構成を変えたい場合のみここを更新する。
 */

/** 外部サイトへのリンク(GitHub・デモ等)。url は https:// から書く */
export type WorkLink = {
	label: string;
	url: string;
};

/** 作品 1 件分(showcase のタイルと profile の詳細で共有) */
export type Work = {
	/** アンカー(/profile#work-{id})に使う識別子。半角英小文字・数字・ハイフンのみ */
	id: string;
	/** 作品名(欧文はディスプレイフォントで表示される) */
	title: string;
	/** 一行説明(タイルと詳細の導入で共有) */
	blurb: string;
	/** プレースホルダビジュアル(CSS グラデーション)の色相(0〜360) */
	hue: number;
	/** true にすると showcase のタイルに載る(最大 4 件) */
	featured?: boolean;
	/** 詳細説明の段落(profile のみ表示) */
	description?: string[];
	/** 担当・役割 */
	role?: string;
	/** 使用技術 */
	tech?: string[];
	/** 制作時期(表示用の文字列。「2026」「2025 — 現在」など形式は自由) */
	period?: string;
	/** 作品の外部リンク(リポジトリ・デモ等) */
	links?: WorkLink[];
};

/** 経歴 1 件分 */
export type CareerEntry = {
	/** 期間(表示用の文字列。「2020 — 現在」など形式は自由) */
	period: string;
	/** 役職・学位など */
	title: string;
	/** 所属 */
	org?: string;
	/** 補足(1〜3 文程度) */
	summary?: string;
};

/** スキル 1 項目分 */
export type SkillItem = {
	name: string;
	/** 補足(「業務で 3 年」など。数値・星による自己評価は使わない方針) */
	note?: string;
};

/** スキルの分類(「フロントエンド」など) */
export type SkillGroup = {
	label: string;
	items: SkillItem[];
};

/** サイト全体のコンテンツ(表示文言)一式 */
export type SiteContent = {
	site: {
		/** サイト名。ブラウザタブの表示(<title>)と入口の見出しに使われる */
		title: string;
		/** 入口ページのリード文 */
		entryLead: string;
		/** 2 つの面のラベルとリード文(入口カード・右上の切り替えボタン・各面で共有) */
		faces: {
			showcase: { label: string; lead: string };
			profile: { label: string; lead: string };
		};
		navigation: {
			top: string;
			switcherLabel: string;
			entryLabel: string;
			skipToContent: string;
			scrollHint: string;
		};
	};
	/** 名前とステートメント(showcase のヒーローと profile のヘッダーで共有) */
	hero: {
		name: string;
		/** 改行したい位置に \n を書く(showcase の大見出しで改行される) */
		statement: string;
		worksLabel: string;
	};
	/** 面 2(profile)の経歴・スキル */
	profile: {
		/** セクション見出し */
		sectionLabels: {
			about: string;
			career: string;
			skills: string;
			works: string;
			links: string;
		};
		workMetaLabels: {
			role: string;
			period: string;
			tech: string;
		};
		/** 自己紹介の段落 */
		intro?: string[];
		/** 経歴(書いた順 = 表示順。新しい順に書く) */
		career: CareerEntry[];
		skills: SkillGroup[];
		/** 外部リンク(GitHub 等) */
		links?: WorkLink[];
	};
	/** 作品一覧(showcase タイルと profile 詳細で共有) */
	works: Work[];
};
