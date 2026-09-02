/*
 * 検索用の分かち書き。外部の形態素解析器を持ち込めない(外部依存を作らない方針)ので、
 * 言語ごとに単純な規則で切る。
 *
 *   英数字     … そのまま 1 語(typescript, svelte, 2026 など)
 *   日本語     … 文字バイグラム(「スキル」→「スキ」「キル」)
 *
 * バイグラムは辞書なしで日本語の部分一致を拾える定番の手法で、
 * 「スキルは?」と「スキル」のような表記ゆれを吸収できる。
 * 完全な形態素解析ではないぶん、無関係な語をわずかに拾うことがあるが、
 * BM25 のスコアリング(retrieve.ts)で埋もれるため実用上は問題にならない。
 */

/** 日本語(ひらがな・カタカナ・漢字・長音符)の範囲 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;
/** 検索に使う語のまとまり(英数字の連なり / 日本語の連なり) */
const RUNS = /[a-z0-9+#.]+|[぀-ヿ㐀-䶿一-鿿豈-﫿]+/g;

/** 単独で現れても意味を持たない助詞など。1 文字の日本語トークンから除く */
const STOP_CHARS = new Set([
	'は',
	'が',
	'を',
	'に',
	'で',
	'と',
	'の',
	'も',
	'や',
	'へ',
	'か',
	'ね',
	'よ',
	'な',
	'だ',
	'で',
	'す',
	'ま',
	'た'
]);

/**
 * 検索用トークンに分解する。
 * 全角・半角の違いは NFKC 正規化で吸収し、英字は小文字に揃える。
 */
export function tokenize(text: string): string[] {
	const normalized = text.normalize('NFKC').toLowerCase();
	const tokens: string[] = [];

	for (const run of normalized.match(RUNS) ?? []) {
		if (!JAPANESE.test(run)) {
			// 英数字はそのまま 1 語。前後に付いた記号は落とす
			const word = run.replace(/^[.#+]+|[.]+$/g, '');
			if (word.length > 0) tokens.push(word);
			continue;
		}

		if (run.length === 1) {
			if (!STOP_CHARS.has(run)) tokens.push(run);
			continue;
		}
		// 2 文字以上の日本語はバイグラムに割る
		for (let index = 0; index < run.length - 1; index += 1) {
			tokens.push(run.slice(index, index + 2));
		}
	}

	return tokens;
}
