# 0001 - Declarative Tracking-as-Code (Plan/Apply) Architecture for GA4 Automation

## Status
Accepted

## Context
Google Analytics 4 (GA4) のプロパティ作成、データストリーム作成、カスタムディメンション/指標（Custom Definitions）の設定自動化アプリの設計方針を決定する必要がある。
世の中の既存ツールを調査したところ：
1. **単発Pythonスクリプト / 公式サンプル**: 冪等性がなく、既存リソースがあるとエラー停止する。ドライラン（差分確認）がない。
2. **エンタープライズSaaS (Avo, Trackingplan等)**: 月額高額、CLI/GitOps中心の軽量利用には不向き。
3. **Chrome拡張 / スプレッドシートアドオン**: Gitでのバージョン管理やCI/CD連携ができない。

Jev Decision Engine (model: `jev-1.13.0`) による評価：
- `market_saturation`: 0.08 (市場に宣言的IaCツールは未充足)
- `best_differentiation_strategy`: `iac_declarative_diff` (確信度 1.0)
- `value_proposition_score`: 2.66 / 3.0 (Critical gap filler / Solid utility)

## Decision
本ツールは「**Tracking-as-Code（コードによるトラッキング構成管理）**」をコアコンセプトとする Python CLI ツールとして設計・実装する。

### コア機能・差別化要素
1. **宣言的設定（Declarative Schema）**:
   - YAML または JSON によるプロパティ・ストリーム・カスタム定義のスキーマ定義。
2. **`plan`（ドライラン・差分検知）コマンド**:
   - GA4 Admin API から既存状態を取得し、定義ファイルとの差分（追加・既存一致・競合）をターミナル上にカラー表示（Terraformライク）。
3. **`apply`（冪等同期）コマンド**:
   - 差分のみを安全に作成・更新。すでに存在するリソースは安全にスキップ（冪等性の担保）。
4. **GA4 クォータガードレール（Quota Guardrails）**:
   - GA4 の上限（イベントスコープ50件、ユーザースコープ25件）を事前にチェックし、あふれる場合は警告または中断。
5. **環境別プロファイル（Multi-Environment Support）**:
   - `dev`, `staging`, `prod` などの環境ごとのオーバーライド定義に対応。

## Consequences
- 利点: GitOps（Pull Request でトラッキング設計をレビュー＆マージ）が可能になり、環境間のドリフトや手作業ミスを根絶できる。
- 課題: GA4 Admin API の仕様（一度作成したカスタムディメンションのパラメータ変更不可、アーカイブ動作など）に対応した安全設計が必要。

## Alternatives Considered
- **単なる一括作成スクリプト**: 既に多くのスクリプトが存在し、差別化できずエラー時の復旧が困難なため却下。
- **スプレッドシート連携専用ツール**: 開発者ワークフローやCI/CDと相性が悪いため副次的な機能に留める。
