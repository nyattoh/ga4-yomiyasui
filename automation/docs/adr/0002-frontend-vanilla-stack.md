# ADR-0002: 生CSSとVanilla JSによる超軽量・ゼロビルドフロントエンドの採用

## Status
Accepted

## Context
要件定義書（REQ-GA4-YOMIYASUI-001）では、GA4 Data API を読む単一フロントエンド（HTML/JS）のビューアを策定している。
当初 Tailwind CSS CDN の利用が検討されたが、ユーザーフィードバックおよび Jev 判定（Jev choice: `pure_css` 1.0, `pure_vanilla_js` 0.89）を受け、外部ランタイム依存を排した最軽量構成への見直しを行った。

## Decision
1. **生 CSS（Pure CSS）の採用**:
   - Tailwind Play CDN 等の巨大ランタイムは使用せず、CSS変数（カスタムプロパティ）とモダンな Flexbox / CSS Grid による生 CSS を採用する。
   - `style.css` に集約し、ゼロビルド・完全な依存ゼロを実現する。
2. **Pure Vanilla JS の採用**:
   - Alpine.js 等のフレームワークも使用せず、標準の ECMAScript (Vanilla JS) で状態管理と DOM / Chart.js ライフサイクルを制御する。
   - 唯一の外部依存ライブラリはグラフ描画用の `Chart.js`（CDN 1本）のみとする。
3. **ファイル構成**:
   - `index.html` (マークアップ)
   - `style.css` (スタイリング)
   - `app.js` (API通信・状態管理・Chart.js制御)
   - 関心の分離（Separation of Concerns）を維持し、コードレビューと保守性を最大化する。

## Consequences
- **メリット**:
  - `npm install` やビルドコマンドが一切不要。Web サーバーや GitHub Pages に置くだけで即座に動作する。
  - ランタイム読み込み速度が極めて高速で、外部スクリプト破損や CDN 仕様変更のリスクが最小限。
  - コードベースが小さく、誰でもコードを読んで改修できる（OSSとして理想的）。
- **トレードオフ**:
  - 双方向データバインディングを手動（シンプルな `render()` またはイベント通知）で行う必要があるが、画面内の入力・表示ブロック数が限定的であるため十分管理可能。
