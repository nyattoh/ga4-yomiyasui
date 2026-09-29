# アーキテクチャノート: CLI と フロントエンドの関係

## 概要

このリポジトリは2つのコンポーネントから構成されます:

1. **フロントエンド** (リポジトリルート): 静的Webアプリ（HTML + JS + CSS）
2. **CLI自動化ツール** (`automation/`): Python製のGA4セットアップCLI

両者は **同じGA4プロパティ** を操作しますが、役割と実行環境が異なります。

## コンポーネント比較

| 項目 | フロントエンド | CLI |
|------|---------------|-----|
| 実行環境 | ブラウザ | ローカル/サーバー |
| 言語 | JavaScript (Vanilla) | Python 3.9+ |
| 認証方式 | Google Identity Services (GIS) | OAuth 2.0 (InstalledAppFlow) |
| 主な機能 | レポート閲覧・可視化 | プロパティ/ストリーム自動作成 |
| 使用API | GA4 Data API (読み取り) | GA4 Admin API (書き込み) |
| データ保存 | localStorage | config.yaml |

## データフロー

```
[ユーザー]
    |
    ├─ ブラウザでフロントエンド起動
    |   └─ レポート取得 (Data API)
    |       └─ Chart.jsで可視化
    |
    └─ CLIでセットアップ実行
        └─ プロパティ/ストリーム作成 (Admin API)
            └─ property_id を config.yaml に保存
```

## 統合ポイント

### property_id の共有

- **CLI**: プロパティ作成後、`config.yaml` に `property_id` を保存
- **フロントエンド**: プロパティ選択ドロップダウンで同じ `property_id` を使用

### 測定IDの受け渡し

1. CLIでWEBストリーム作成 → `measurement_id` (G-XXXXXXX) を取得
2. ユーザーが手動でWebサイトのHTMLに埋め込み
3. フロントエンドでレポート閲覧開始

## ディレクトリ構成

```
ga4-yomiyasui/              # リポジトリルート
├── index.html              # フロントエンド: メインHTML
├── app.js                  # フロントエンド: ロジック
├── style.css               # フロントエンド: スタイル
├── README.md               # フロントエンド: 日本語README
├── automation/             # CLI: Pythonパッケージ
│   ├── src/
│   │   └── ga4_automation/
│   ├── tests/
│   ├── docs/
│   ├── README.md           # CLI: 日本語README
│   └── pyproject.toml
└── .gitignore              # 共通gitignore
```

## GitHub Pagesとの互換性

- **GitHub Pagesは `main` ブランチのルートを配信**
- フロントエンドファイル (`index.html` 等) はルートに配置
- CLIは `automation/` サブディレクトリに配置
- この構成により、GitHub Pagesは影響を受けずに動作し続ける

## セキュリティ

### 認証情報の分離

- **フロントエンド**: クライアントIDのみ（公開OK）
- **CLI**: client_secret + token.json（非公開、.gitignore済み）

### .gitignore

```
# CLI認証情報（絶対にコミットしない）
automation/credentials/
automation/client_secret*.json
automation/token.json
```

## 将来の拡張

### API統合

CLIとフロントエンドを連携させる場合:

1. CLIをWebサーバー化（FastAPI等）
2. フロントエンドから `fetch()` でCLI APIを呼び出し
3. プロパティ作成をブラウザから直接実行可能に

### CI/CDパイプライン

GitHub Actionsで:

1. フロントエンドのビルド（不要、静的ファイルのまま）
2. CLIの単体テスト実行
3. GitHub Pagesへ自動デプロイ

## 参考リンク

- [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [GA4 Admin API](https://developers.google.com/analytics/devguides/config/admin/v1)
- [Google Identity Services (GIS)](https://developers.google.com/identity/gsi/web)
