# atf-demo-web

ポートフォリオサイト。100% カスタマイズ可能な自分のサイトとして、2 つの面を持つ構成を目指す。

- 面 1 = ビジュアル特化の面(スタイリッシュで、ずっと見ていたくなり、ポートフォリオがなんとなく理解できる)
- 面 2 = 情報整理の面(経歴・スキル・作品詳細を落ち着いて読める)

## 技術スタック

- [SvelteKit](https://svelte.dev/docs/kit)(Svelte 5)+ TypeScript
- `@sveltejs/adapter-static` による完全静的出力(全ページ prerender)
- ESLint / Prettier / Vitest

## 外部非依存の方針

このサイトは**外部リソースを一切読み込まない**。

- 外部フォント(Google Fonts 等)・外部 CDN・外部 API・アナリティクスは使用しない
- フォント・画像などの全アセットはリポジトリ内に同梱してバンドルする(フォントを追加するまではシステムフォントスタックを既定とする)
- ただし、外部サイトへのハイパーリンク(`<a href>`)は許可する

## 開発

Node.js 20.19 以上(推奨 22.12+)が必要(Vite 8 の engines 要件。`.npmrc` の `engine-strict=true` により、範囲外の Node では `npm install` が失敗する)。

```sh
npm install
npm run dev        # 開発サーバー起動
```

## npm scripts

| コマンド          | 内容                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`     | 開発サーバーを起動する                                                                                                                          |
| `npm run build`   | 静的サイトを `build/` に出力する                                                                                                                |
| `npm run preview` | ビルド結果をローカルで確認する                                                                                                                  |
| `npm run check`   | svelte-check による型チェック                                                                                                                   |
| `npm run lint`    | Prettier のフォーマット確認 + ESLint                                                                                                            |
| `npm run format`  | Prettier で整形する                                                                                                                             |
| `npm run test`    | Vitest を 1 回実行する(`test:unit` はウォッチモード)                                                                                            |
| `npm run verify`  | lint / check / test / build に加え、ビルド成果物の静的検証(check-static: ページ存在・相互到達性・外部 URL 参照なし)をまとめて実行する(品質確認) |

## ディレクトリ

- `src/routes/` — ページ(ルーティング)
- `src/lib/assets/fonts/` — 同梱フォントの置き場(現状は空)
- `src/lib/styles/` — 共有スタイルの置き場(現状は空)
- `static/` — そのまま配信される静的ファイル
