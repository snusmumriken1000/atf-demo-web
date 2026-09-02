# atf-demo-web

ポートフォリオサイト。100% カスタマイズ可能な自分のサイトとして、2 つの面を持つ構成を目指す。

- 面 1 = ビジュアル特化の面(スタイリッシュで、ずっと見ていたくなり、ポートフォリオがなんとなく理解できる)
- 面 2 = 情報整理の面(経歴・スキル・作品詳細を落ち着いて読める)

## 技術スタック

- [SvelteKit](https://svelte.dev/docs/kit)(Svelte 5)+ TypeScript
- `@sveltejs/adapter-static` による完全静的出力(全ページ prerender)
- ESLint / Prettier / Vitest / Playwright

## 外部非依存の方針

このサイトは**外部リソースを一切読み込まない**。

- 外部フォント(Google Fonts 等)・外部 CDN・外部 API・アナリティクスは使用しない
- フォント・画像などの全アセットはリポジトリ内に同梱してバンドルする(フォントを追加するまではシステムフォントスタックを既定とする)
- ただし、外部サイトへのハイパーリンク(`<a href>`)は許可する

## 空間オーディオ(面 1)

面 1(Showcase)では、ヒーローと各作品タイルが**画面上の位置から聞こえる**音場を鳴らせる。
定位は Web Audio API の `PannerNode`(`panningModel: 'HRTF'`)によるバイノーラル処理で、
ポインタを動かすと音像が追従する。前後・上下まで含めた定位はヘッドホンで聴くとよく分かる。

- **音声ファイルは持たない**: 音はオシレータとノイズからブラウザ内で合成する。残響の
  インパルス応答もコードで生成するため、追加されるバイナリ資産は 0 byte(外部非依存の方針に沿う)
- **既定は無音**: 右上の `Sound` トグルを押すまで `AudioContext` を作らない。ブラウザの自動再生制限に
  適合し、WCAG 1.4.2(3 秒を超える音声には停止手段が必要)も満たす。選択は `localStorage` に保存する
- **面 2 は無音**: 落ち着いて読む面という役割を保つため、トグルは面 1 にだけ出る
- **`prefers-reduced-motion: reduce`**: 音像を動かさない(音源の定位は保つ)
- **非対応ブラウザ**: `AudioContext` がなければトグル自体を描画しない(段階的強化)
- タブが隠れている間は `AudioContext` を suspend する

音の高さは各作品の `hue`(色相)から自動で決まるため、タイルの色と音程が対応する。
音量・基準の高さ・音域は [`src/lib/data/content.ts`](src/lib/data/content.ts) の `audio` で調整する。

| ファイル                                      | 役割                                               |
| --------------------------------------------- | -------------------------------------------------- |
| `src/lib/audio/spatialField.ts`               | 画面位置・色相 → 3D 座標・音程の写像(純粋関数)     |
| `src/lib/audio/spatialAudioEngine.ts`         | Web Audio のノードグラフ生成と音源・リスナーの制御 |
| `src/lib/audio/soundPreference.ts`            | 設定の保存・復元(`localStorage`)                   |
| `src/lib/components/SoundToggle.svelte`       | オン / オフのトグル(FaceSwitcher 内に表示)         |
| `src/lib/components/SpatialAudioScene.svelte` | 要素位置とポインタを音場へ反映する(描画なし)       |

## コンテンツの差し替え

サイトに表示する名前、紹介文、経歴、スキル、作品、リンク、各ページの案内文は
[`src/lib/data/content.ts`](src/lib/data/content.ts) に集約している。この 1 ファイルを編集すれば、
入口・Showcase・Profile の表示へ反映される。現在値はすべてサンプル。

1. `hero` の名前とステートメントを差し替える
2. `profile` の自己紹介・経歴・スキル・外部リンクを編集する
3. `works` を作品単位で追加・削除し、Showcase に出す作品へ `featured: true` を付ける
4. `audio` で面 1 の音(音量・基準の高さ・音域)とトグルの文言を調整する
5. `npm run verify` で型、表示テスト、静的出力、外部リソース非依存を確認する

項目ごとの説明と最小構成例は `content.ts` 内のコメントを参照する。画像を追加する場合は外部 URL
から読み込まず `src/lib/assets/` または `static/` に同梱する。外部サイトへの作品リンクは `https://`
URL を指定できる。フィールド構成そのものを変える場合だけ
[`src/lib/data/content.types.ts`](src/lib/data/content.types.ts) も更新する。

`npm run verify` は `https://` 以外の外部リンク、作品 ID の形式・重複、表示リストのキー重複も
検出する。さらに Playwright Chromium で全 3 ルートを開き、遅延表示後までのネットワーク通信が
配信元と同一オリジンまたは `data:` URI に限られることを実行時に確認する。外部リンクは監視中に
クリックしない。

## 開発

Node.js 20.19 以上(推奨 22.12+)が必要(Vite 8 の engines 要件。`.npmrc` の `engine-strict=true` により、範囲外の Node では `npm install` が失敗する)。

```sh
npm install
npx playwright install chromium # 初回と CI 環境でブラウザーを用意
npm run dev        # 開発サーバー起動
```

## npm scripts

| コマンド                | 内容                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`           | 開発サーバーを起動する                                                                      |
| `npm run build`         | 静的サイトを `build/` に出力する                                                            |
| `npm run preview`       | ビルド結果をローカルで確認する                                                              |
| `npm run check`         | svelte-check による型チェック                                                               |
| `npm run lint`          | Prettier のフォーマット確認 + ESLint                                                        |
| `npm run format`        | Prettier で整形する                                                                         |
| `npm run test`          | Vitest を 1 回実行する(`test:unit` はウォッチモード)                                        |
| `npm run check:network` | 既存の `build/` をローカル配信し、Playwright で全ルートの実行時外部通信がないことを検証する |
| `npm run verify`        | lint / check / test / build / 静的検証 / 実行時ネットワーク監視をまとめて実行する(品質確認) |

`check:network` を単独実行する場合は、先に `npm run build` を実行する。CI では依存のインストール後に
`npx playwright install chromium`、続いて `npm run verify` を実行する。ネットワーク監視は
ナビゲーション 10 秒、フォント 3 秒、アニメーション 2 秒、最低観測 1 秒を含む通信静止待ち
3 秒の有限な上限を持ち、ページや通信が停止しても無期限には待機しない。

## ディレクトリ

- `src/routes/` — ページ(ルーティング)
- `src/lib/data/content.ts` — サイト全体の表示コンテンツ
- `src/lib/audio/` — 面 1 の空間オーディオ(音場の計算とノードグラフ)
- `src/lib/assets/fonts/` — 同梱フォントの置き場
- `src/lib/styles/` — 共有スタイル
- `static/` — そのまま配信される静的ファイル
