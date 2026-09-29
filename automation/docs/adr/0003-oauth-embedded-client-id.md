# ADR-0003: 組み込み OAuth Client ID とセルフホスト用オーバーライド機構

## Status
Accepted

## Context
GA4 のデータをブラウザから直接取得するためには Google OAuth 2.0 が必須となる。
従来の OSS では「利用者が GCP コンソールで OAuth クライアント ID を発行する」ことを要求するケースが多いが、これは非エンジニアや初心者サイト運営者にとって極めて高い離脱要因となる。
一方で、完全に Client ID なしで Google OAuth 認可を通すことは Google の仕様上不可能である。

## Decision
1. **公式ホスティング版でのデフォルト Client ID 組み込み**:
   - 公式配布URL（例: GitHub Pages）向けに発行した OAuth クライアント ID をコード内に既定値として埋め込む。
   - 一般ユーザーは **「Google でログイン」ボタンを1クリックするだけ** で認証を完了でき、GCP の設定作業を一切不要とする。
2. **Google Identity Services (GIS) Token Model の採用**:
   - `google.accounts.oauth2.initTokenClient` を使用したクライアントサイド認可を行う。
   - クライアントシークレット（Client Secret）は不要かつ保持しない。
   - 要求スコープは `https://www.googleapis.com/auth/analytics.readonly` のみに厳格制限する。
3. **セルフホスト / ローカル開発用オーバーライド機能**:
   - デフォルト Client ID は登録された承認済み生成元（Authorized JavaScript origins）でのみ動作するため、別ドメインやローカルでホストする開発者向けに、画面右上の設定モーダルから「独自の Client ID」を入力・LocalStorage 保存できる脱出ハッチを用意する。
4. **デモモードのファーストクラス維持**:
   - Google ログイン前でも、初期状態で高品質なモックデータによる画面確認（デモモード）を可能とし、認証なしでもツールの価値を体験できるようにする。

## Consequences
- **メリット**:
  - 初心者ユーザーが GCP の複雑な画面に触れることなく、即座に実データを閲覧できる。
  - バックエンドサーバーを持たないため、ユーザーのアクセストークンやGAデータが第三者サーバーを経由せず、プライバシーが完全に保護される。
- **トレードオフ**:
  - `analytics.readonly` は Sensitive Scope に該当するため、公式版の一般公開にあたり Google の OAuth 同意画面の検証（Verification）申請が必要となる（未検証期間中は「確認されていません」の警告画面を承諾して進む形となる）。
