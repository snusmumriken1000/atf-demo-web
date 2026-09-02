# atf-demo-web

自分のポートフォリオを他の人に見てもらうためのポートフォリオサイト(新規開発)。

- 技術スタック: TypeScript + Svelte
- 中核価値: 100% カスタマイズ可能な自分のサイト
- 必須要件: サイト内に 2 つの面(ページ/ビュー)を作る
  - 面 1(ビジュアル特化の面): スタイリッシュで、ずっと見ていたくなり、ポートフォリオがなんとなく理解できる面
  - 面 2(情報整理の面): 経歴・スキル・作品詳細などを落ち着いて読める面
- 制約(やらないこと): 構築するサイトから外部のサイトにアクセスしない(外部 CDN・外部フォント・外部 API 等に依存しない自己完結な構成にする)。ただし外部ハイパーリンク(`<a href>`)を置くことは可
- コンテンツ管理(必須要件): サイトに表示する文言・コンテンツ(経歴・スキル・作品詳細、ヒーロー文言、リード文など)は**単一のコンテンツファイルに集約**し、そのファイルだけ編集すればサイト全体に反映される構造にする
- トレードオフの最優先: 品質(品質を落とさない)
- 判断に迷ったら `.claude/inception-deck.md` に立ち返る

<!-- atf:team -->

## チーム運用(agent-team-factory)

### チーム構成

`.claude/agents/` に定義されたエージェント:

- **orchestrator**: チーム全体をまとめ、タスクの計画から完了まで開発を推進する起点。タッチポイントで一時停止しユーザー承認を仰ぐ
- **issue-manager**: GitHub Issues の起票・整理・優先順位付け・クローズ判断
- **architect**: 実装前の設計検討・影響範囲調査・アーキテクチャ上のトレードオフ判断
- **implementer**: 設計方針に沿った機能追加・バグ修正・リファクタリングの実装
- **test-engineer**: テストの作成・実行・失敗解析、変更の検証
- **code-reviewer**: 変更差分のレビュー、マージ前の品質チェック
- **doc-writer**: README・API ドキュメント・変更履歴の作成・更新
- **env-builder**: 実行環境(ハーネス・ガードレール・フィードバックループ)の整備と運用ルールの点検

### タスクの流れ

orchestrator → issue-manager → architect → implementer → (test-engineer / code-reviewer / doc-writer)

### Issue 駆動開発

- 使用リポジトリ: `snusmumriken1000/atf-demo-web`(gh CLI では `-R snusmumriken1000/atf-demo-web` を指定)
- 作業は必ず対応する GitHub Issue を起点に行い、Issue 番号(#123)を確認してから着手する
- 対応する Issue がない作業は、先に issue-manager で Issue を起票する
- 成果物の報告・コミットメッセージ・実行記録に Issue 番号を含める

### main への反映フロー

- 作業単位ごとにブランチを作成する(例: `feature/issue-123-short-summary`)。分岐元は必ず `origin/main`
- `npm run verify` が通ってからコミットする。コミットメッセージに Issue 番号と `Closes #123` を含める
- **PR は必須ではない**。verify 通過後、作業ブランチから main へ直接反映してよい(ユーザー指示 2026-09-03)。
  反映後に総括(実装概要・テスト結果)をユーザーに提示する
- PR を作るのは、レビューを挟みたいとき・差分が大きいとき・ユーザーから依頼があったときだけ

**反映コマンド(この形以外を使わない):**

```sh
git push origin <作業ブランチ>:main
```

**注意: ローカルの `main` ブランチは使わない。** ローカル `main` は別プロジェクト(React の Todo デモ)の
履歴で `origin/main` と共通の祖先を持たない。`git checkout main` するとワークツリーが入れ替わり、
`git merge origin/main` は "unrelated histories" で失敗する。基準は常に `origin/main`。

### タッチポイント(人間の承認が必要な境界)

- **issue-approval**: エージェントが起票した Issue は、ユーザーが内容を確認・承認してから着手する。承認前に実装を始めない

### 観測の入口(実行記録)

- 実行記録: `.claude/atf-logs/runs.jsonl`(JSON Lines 形式)
- ダッシュボード: `.claude/atf-dashboard.html`(`atf report` で再生成)
- 各エージェントは作業完了時に以下形式の JSON を 1 行追記する:

```json
{
	"agent": "<エージェント名>",
	"task": "依頼内容の要約",
	"inputs": "受け取った主な入力",
	"outputs": "生成した主な成果物",
	"status": "success",
	"issue": "#123",
	"finishedAt": "<ISO 8601 現在時刻>"
}
```

- 失敗時は `status` を `"failure"` にする
- Issue に紐づく作業では `"issue"` フィールドを含める

<!-- atf:team:end -->
