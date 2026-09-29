# Continuity Ledger

- Goal (incl. success criteria):
  - サイト（プロパティ）切り替え時に前のデータが残ってしまう不具合の解消。
  - 成功基準:
    1. プロパティ変更（および期間変更・更新）時に直ちにローディング状態（`resetViewToLoading`）になり、前のデータが消えること [達成]
    2. 新規サイト等でデータが0件（空行・null）の場合でも、古いChartインスタンスを確実に破棄し、「まだデータが計測されていません」と明示描画すること（早期リターンによるDOM残留バグの解消） [達成]
    3. 各APIクエリを個別にフォールバック（`runReportSafe`）し、特定クエリの失敗で全体がコケて前の画面のまま残る現象を防止すること [達成]
    4. リモートリポジトリ（GitHub Pages: nyattoh/ga4-yomiyasui）へプッシュ完了 [達成]
- Constraints/Assumptions:
  - 完全GUI（ブラウザ単体で完結）
  - ゼロビルド・生CSS・Vanilla JS・Chart.js
  - 公開URL: `https://nyattoh.github.io/ga4-yomiyasui/`
- State:
  - Done:
    - `app.js` に `resetViewToLoading()` を実装（全ブロック・グラフ・AIアドバイザーの初期化）
    - 各 `render` 関数（`renderChannels`, `renderDevices`, `renderOS`, `renderLocation`, `renderOverview`, `renderEngagement`, `renderKeyEvents`）の空状態（Empty State）ハンドリングを徹底
    - `runReportSafe` による安全フォールバックの実装
    - `docs/error-solving/understood-errors.md` にエラーパターンと回避策を記録
  - Now:
    - Git コミット＆プッシュ（nyattoh/ga4-yomiyasui）
    - ユーザーへの原因と対応内容の報告
- Working set (files/ids/commands):
  - `ga4-yomiyasui/app.js`
  - `docs/error-solving/understood-errors.md`
  - 公開URL: `https://nyattoh.github.io/ga4-yomiyasui/`
