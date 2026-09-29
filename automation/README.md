# GA4 Setup Automation (`ga4-sync`)

> このパッケージは [ga4-yomiyasui](https://github.com/nyattoh/ga4-yomiyasui) リポジトリの automation/ 配下に同梱されています。GitHub Pages 用の静的ファイル（index.html 等）はリポジトリルートに置き、CLI はここから pip install -e . / ga4-sync で利用します。


Google Analytics 4 (GA4) の構成（プロパティ、データストリーム、カスタムディメンション、カスタム指標）をコードとして管理する **Tracking-as-Code (IaC)** CLI ツールです。

Terraform のように、適用前に変更内容をカラー表示で確認できる `plan`（ドライラン差分検出）と、冪等に同期する `apply` を備えています。また、GA4 特有の上限枠（イベントディメンション50個、ユーザーディメンション25個など）を事前にシミュレーションする **Quota Guardrail** を内蔵しています。

---

## 🌟 特長・差別化ポイント

1. **宣言的設定 (Declarative Schema)**:
   - トラッキング定義を YAML で Git 管理（GitOps）。Pull Request でのレビューが可能。
2. **`plan` (事前差分・ドライラン)**:
   - GA4 のリモート状態を取得し、新規作成（CREATE）、更新（UPDATE）、スキップ（NOOP）を識別して表示。
3. **`apply` (冪等同期)**:
   - 変更が必要な差分のみを API に送信。何度実行しても安全に定義通りの状態に収束。
4. **Quota Guardrail (上限警告エンジン)**:
   - Standard / 360 の枠に対して、何%消費するかを事前にシミュレーションし、あふれる場合は実行を停止。
5. **`inspect` & `export` (リバースエンジニアリング)**:
   - 既存の GA4 プロパティの状態・クォータを可視化。
   - 既存プロパティから YAML 設定ファイルを逆生成して即座にコード管理へ移行可能。

---

## 🚀 クイックスタート

### 1. インストール

```bash
# パッケージのインストール
pip install -e .
```

### 2. Google Cloud 側の準備

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成または選択します。
2. **Google Analytics Admin API** を有効化します。
3. **サービスアカウント** を作成し、JSON キーをダウンロードします（例: `credentials.json`）。
4. [Google Analytics 管理画面](https://analytics.google.com/) の「アカウントのアクセス管理」または「プロパティのアクセス管理」から、作成したサービスアカウントのメールアドレスに **「編集者」または「管理者」** の権限を付与します。

> ⚠️ **セキュリティ注意**: `credentials.json` などの認証キーは絶対に Git にコミットしないでください（`.gitignore` に設定済みです）。

---

## 📖 コマンドの使い方

### ① 既存 GA4 プロパティの状況を確認 (`inspect`)

```bash
python -m src.cli inspect --property-id 123456789 --credentials credentials.json
```

### ② 既存 GA4 プロパティを YAML 設定ファイルに書き出し (`export`)

既存の設定をそのまま IaC 化できます：

```bash
python -m src.cli export --property-id 123456789 --output config/my-ga4.yaml --credentials credentials.json
```

### ③ 設定の変更差分をプレビュー (`plan`)

**Google API に接続して差分確認する場合**（サービスアカウントキーが必要）:
```bash
python -m src.cli plan --config config/ga4-config.example.yaml --credentials credentials.json
```

**キーなしでローカル検証・シミュレーションする場合 (`--offline`)**:
```bash
python -m src.cli plan --config config/ga4-config.example.yaml --offline
```
※ `--offline` を指定すると、Google API への通信を行わずにローカル定義の構文チェック、GA4 上限枠（クォータ）のシミュレーション、新規作成プランの可視化が可能です。

### ④ 変更を安全に適用 (`apply`)

```bash
python -m src.cli apply --config config/ga4-config.example.yaml --credentials credentials.json
```
CI/CD 等で対話プロンプトをスキップしたい場合は `--auto-approve` を付与します：
```bash
python -m src.cli apply --config config/ga4-config.example.yaml --credentials credentials.json --auto-approve
```

---

## 📝 設定ファイル例 (`config/ga4-config.example.yaml`)

```yaml
version: "1.0"

property:
  property_id: "properties/123456789"
  display_name: "My Awesome Web App (Production)"
  time_zone: "Asia/Tokyo"
  currency_code: "JPY"
  industry_category: "TECHNOLOGY"

data_streams:
  - name: "Web Production Stream"
    type: "WEB"
    default_uri: "https://example.com"

custom_dimensions:
  - parameter_name: "content_category"
    display_name: "Content Category"
    description: "Category of the viewed content"
    scope: "EVENT"

  - parameter_name: "user_membership_tier"
    display_name: "Membership Tier"
    description: "User subscription tier"
    scope: "USER"

custom_metrics:
  - parameter_name: "scroll_depth_percent"
    display_name: "Scroll Depth Percentage"
    description: "Deepest scroll percentage reached"
    measurement_unit: "STANDARD"
    scope: "EVENT"
```

---

## 🧪 テストの実行

Windows 環境では、アクティブな Python インタプリタ経由で実行します：

```bash
python -m pytest -v
```
