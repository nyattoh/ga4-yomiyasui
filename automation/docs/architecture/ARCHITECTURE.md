# Architecture Documentation: ga4-setup-automation

## Project Overview
GA4 (Google Analytics 4) の設定を宣言的なコード（YAML）として定義し、Terraform のように差分検出（`plan`）と冪等適用（`apply`）を行う "Tracking-as-Code" CLI ツール。

## Tech Stack
- **Language**: Python 3.10+
- **Google SDK**: `google-analytics-admin` (v1alpha / v1beta API)
- **Authentication**: `google-auth` (Service Account JSON / Application Default Credentials)
- **Data Modeling & Validation**: `pydantic` v2
- **Config Serialization**: `PyYAML`
- **CLI Framework**: `click` / `rich` (美しい差分表示とテーブル出力)

## Directory Structure
```
ga4-setup-automation/
├── .gemini/
│   └── config.json
├── docs/
│   ├── architecture/
│   │   └── ARCHITECTURE.md
│   ├── short-term-plan/
│   │   └── CONTINUITY.md
│   └── error-solving/
├── decisions/
│   └── 0001-declarative-tracking-as-code.md
├── tasks/
│   └── current.json
├── config/
│   └── ga4-config.example.yaml   # 宣言的設定のひな形
├── src/
│   ├── __init__.py
│   ├── cli.py                    # CLI コマンド (plan, apply, inspect)
│   ├── client.py                 # GA4 Admin API ラッパー
│   ├── schema.py                 # Pydantic 定義 (Property, Stream, CustomDimension, Metric)
│   ├── diff.py                   # 既存状態と定義の差分エンジン
│   └── quota.py                  # GA4 クォータ上限バリデータ
├── tests/
├── pyproject.toml
└── README.md
```

## Key Architectural Patterns
1. **Declarative State Sync**:
   - `plan`: ターゲットプロパティの現在の状態を GA4 Admin API から全取得し、YAML 定義と比較して差分（Create / Skip / Update）を算出。クォータ超過も警告。
   - `apply`: 差分のみを API にリクエスト。既存の重複登録エラーを防止し、安全に同期完了。
2. **Idempotency (冪等性)**:
   - 何度実行しても同じ状態に収束し、副作用を生じさせない。
3. **Quota Safety Guardrail**:
   - GA4 の上限（標準プロパティ: イベントディメンション50、ユーザーディメンション25、指標50など）をコミット前にチェック。

## Related frontend (ga4-yomiyasui)

The nested directory ga4-yomiyasui/ is a **separate** static frontend (vanilla HTML/CSS/JS) for a GA4 Data API read-only viewer. It is intentionally **not** vendored into this CLI package (see .gitignore).

- Own git remote: https://github.com/nyattoh/ga4-yomiyasui
- GitHub Pages (project site, repo root on main): https://nyattoh.github.io/ga4-yomiyasui/
- Auth model: GIS Token Model with embedded OAuth Client ID (ADR-0003); no client secret in the browser or this repo
- Stack / layout: ADR-0002

This CLI (ga4-sync) manages Admin API configuration (plan/apply/inspect/export). The frontend only consumes Analytics Data API for dashboards and does not call Admin apply.

