/*
 * サイトコンテンツ(content.ts)の型定義。
 *
 * このファイルは編集不要。サイトの文言を変えるときは content.ts だけを編集する。
 * 必須 / 任意(`?` 付き)の区分やフィールド構成を変えたい場合のみここを更新する。
 */

/** 外部サイトへのリンク(GitHub・デモ等)。url は https:// から書く */
export type WorkLink = {
	label: string;
	/** 外部リンクだけを扱う。javascript: や http: は型検査で拒否する */
	url: `https://${string}`;
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

/**
 * 面 1(showcase)の空間オーディオ設定。
 *
 * 音は音声ファイルではなくブラウザ内で合成しているので、ここの数値を変えると
 * 音そのものが変わる(音源ファイルの差し替えは不要)。
 */
export type AudioContent = {
	/** トグルに出す短いラベル(例: 'Sound') */
	label: string;
	/** 音を鳴らす操作の説明(スクリーンリーダー向け) */
	enableLabel: string;
	/** 音を止める操作の説明(スクリーンリーダー向け) */
	disableLabel: string;
	/** トグルの近くに出す補足。3D 定位はヘッドホンでよく分かる旨を書く */
	hint: string;
	/** 全体音量。0(無音)〜 1(最大)。既定は 0.5 */
	volume: number;
	/** テンポ(BPM)。チルな速さは 65〜85 あたり */
	bpm: number;
	/** 主音の高さ(Hz)。曲全体の調が決まる。130.81 = C3 */
	baseHz: number;
	/** メロディが広がる音域(オクターブ数)。大きいほど作品ごとの音程差が開く */
	octaveRange: number;
};

/**
 * 面 3(ask)の文言。
 *
 * ボットは content.ts に書いてあることだけを答える。回答の中身は
 * 経歴・スキル・作品からそのまま引かれ、ここにあるのは前置きや案内の文だけ。
 */
export type AskContent = {
	/** 面を開いたときにボットが最初に出す言葉 */
	greeting: string;
	/** 仕組みの注記。LLM ではなくサイト内検索であることを正直に書く */
	notice: string;
	/** 入力欄のラベル(読み上げ用)とプレースホルダ */
	inputLabel: string;
	placeholder: string;
	/** 送信ボタンの文言 */
	sendLabel: string;
	/** 押すとそのまま送れる質問例(3〜5 件を目安に) */
	suggestions: string[];
	/** 答えられないときの返答 */
	fallback: string;
	/** 回答に添える出典の見出し */
	sourceLabel: string;
	/** 会話ログでの話者の呼び名。botName は話し相手の生き物の名前になる */
	botName: string;
	userName: string;
	/** 生き物の見た目の説明(読み上げ用) */
	companionAlt: string;
	/** 回答の前置き。意図ごとに使い分ける */
	leads: {
		greeting: string;
		help: string;
		about: string;
		career: string;
		skill: string;
		work: string;
		link: string;
		site: string;
		/** 意図が分からず、検索結果だけで答えるときの前置き */
		general: string;
	};
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
			ask: { label: string; lead: string };
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
	/** 面 1(showcase)の空間オーディオ */
	audio: AudioContent;
	/** 面 3(ask)の対話 */
	ask: AskContent;
};
