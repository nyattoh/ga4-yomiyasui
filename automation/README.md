# GA4 自動セットアップ CLI

GA4（Google Analytics 4）のプロパティ・データストリーム・キーイベントを自動作成するPython CLIツールです。

## 🎯 特徴

- **エラー分類**: NotFound (404) と Permission (403) を明確に区別
- **property_id永続化**: 作成後のプロパティIDを自動的にYAMLに保存
- **WEBストリーム限定**: iOS/Androidは未実装で明示的にエラー通知（fail-loud）
- **クォータ管理**: APIレート制限をチェック
- **シンプルな設計**: 最小限の依存関係で動作

## 📦 インストール

```bash
cd automation
pip install -e .
```

または開発モードで:

```bash
pip install -e ".[dev]"
```

## 🚀 使い方

### 1. 認証情報の準備

Google Cloud Consoleで OAuth 2.0 クライアントIDを作成し、`credentials.json` として保存します。

詳細は [親READMEのGoogle Cloud設定手順](../README.md#-google-cloud-の設定手順oauth-クライアントidの取得) を参照してください。

### 2. アカウント一覧を確認

```bash
ga4-setup list-accounts
```

### 3. プロパティ・ストリーム・キーイベントを作成

```bash
ga4-setup setup \
  --account-id YOUR_ACCOUNT_ID \
  --name "マイサイト" \
  --url "https://example.com"
```

実行すると:
- GA4プロパティが作成されます
- WEBデータストリームが作成されます
- 標準キーイベント（form_submit, file_download）が設定されます
- **property_idが `config.yaml` に自動保存されます**

## 📁 ファイル構成

```
automation/
├── src/
│   └── ga4_automation/
│       ├── __init__.py
│       ├── cli.py           # CLIエントリーポイント
│       ├── client.py        # GA4 Admin APIクライアント
│       ├── config.py        # YAML設定管理（property_id永続化）
│       ├── errors.py        # エラー分類（NotFound vs 他）
│       └── quota.py         # クォータチェック（check_quotas import対応）
├── tests/
│   ├── test_client.py       # WEBストリーム限定テスト
│   ├── test_config.py       # property_id永続化テスト
│   ├── test_errors.py       # エラー分類テスト
│   └── test_quota.py        # check_quotas importテスト
├── docs/
│   └── ADR-001-web-only.md  # WEBストリーム限定の設計判断
├── examples/
│   └── config.example.yaml  # 設定ファイル例
├── pyproject.toml
├── requirements.txt
└── README.md                # 本書
```

## 🧪 テスト実行

```bash
cd automation
pytest
```

カバレッジ付き:

```bash
pytest --cov=ga4_automation --cov-report=html
```

## 🔧 設定ファイル

`config.yaml` の例は `examples/config.example.yaml` を参照してください。

プロパティ作成後、`property_id` が自動的に保存されます:

```yaml
property_id: "123456789"
property_name: "properties/123456789"
```

## 🚨 重要な制約

### WEBストリームのみサポート

このCLIは **WEBデータストリーム** のみ対応しています。iOS/Androidストリーム作成を試みると `NotImplementedError` が発生します。

詳細は [ADR-001](docs/ADR-001-web-only.md) を参照してください。

### 認証情報の管理

`credentials.json` や `token.json` は機密情報です。必ず `.gitignore` に追加してください（既に設定済み）。

## 📚 関連ドキュメント

- [ADR-001: WEBストリーム限定の設計判断](docs/ADR-001-web-only.md)
- [親プロジェクトのREADME](../README.md)

## 🔗 フロントエンドとの連携

このCLIはフロントエンド（index.html / app.js）と同じGA4プロパティを操作します。

- **フロントエンド**: ブラウザから直接GA4 Data APIでレポート取得
- **CLI**: サーバーサイドまたはローカルでプロパティ・ストリーム作成を自動化

## 📄 ライセンス

MIT License（親プロジェクトと同じ）
