# GA4 よみやすい (GA4 Yomiyasui)

GA4 の難解な指標やレポート画面を平易な日本語に翻訳し、「今日どの数字を見ればよいか」の結論を先に示す超軽量・オープンソースのアクセス解析ビューアです。

Google 非公式・非提携（MIT License）。

---

## 特徴

1. **専門用語を平易な日本語に固定**:
   - `sessions` → **回数**（サイトを開いた総回数）
   - `activeUsers` → **人数**（訪れた実人数）
   - `engagementRate` → **見ている割合**（滞在・閲覧した訪問の比率）
   - `keyEvents` → **成果**（目標アクションの達成数）
2. **見る順番を固定**:
   - 「人は来ているか → 見ているか → どこから来たか → 成果はあるか → どんな端末か → どの OS か」の固定順で上から読めます。
3. **結論を自動生成**:
   - スマホとパソコンの利用比率の乖離（5pt以上）からリピート傾向を自動判定。
   - 成果（キーイベント）が 0 件のときは、改善提案ではなく「GA4 側の設定未了」の可能性を親切に案内。
4. **ゼロビルド・完全サーバレス**:
   - `npm install` やビルドコマンド不要。Pure Modern CSS + Vanilla JS + Chart.js（CDN 1本）のみで構成。
   - 開発者サーバーを一切経由せず、データはお使いのブラウザと Google 間でのみ通信されます（プライバシー安全）。
5. **デモモード搭載**:
   - Google アカウントのログイン前でも、初期状態で高品質なモックデータによる画面確認が即座に可能です。

---

## 使い方

### 1. デモモードで試す
Web サーバー（または VSCode Live Server 等）で `index.html` を開きます。
初期状態はデモモードで起動し、全ブロックのグラフと表を即座に確認できます。

```bash
# Python の標準サーバーで動かす場合
cd ga4-yomiyasui
python -m http.server 8000
```
ブラウザで `http://localhost:8000` にアクセスします。

### 2. 実際の GA4 データを閲覧する
1. 画面右上の **「Google でログイン」** をクリックします。
2. Google アカウントで認可（要求スコープ: `analytics.readonly` のみ）を完了します。
3. アカウントが持つ GA4 プロパティ一覧が自動取得され、ドロップダウンから選択するだけで実データが反映されます。

---

## セルフホスト・開発者向け設定

ローカル環境（`localhost`）や独自のドメインでホストする場合、Google のセキュリティ制約により `origin_mismatch` エラーが発生することがあります。その場合は以下の手順でご自身の Google Cloud OAuth クライアント ID を設定してください。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成。
2. 「API とサービス」→「ライブラリ」から **Google Analytics Data API** および **Google Analytics Admin API** を有効化。
3. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」を選択。
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 承認済みの JavaScript 生成元: ご自身がホストする URL（例: `http://localhost:8000` や `https://yourdomain.com`）
4. 発行されたクライアント ID（`xxx.apps.googleusercontent.com`）をコピー。
5. 「GA4 よみやすい」の画面右上にある **「⚙ 設定」** ボタンをクリックし、クライアント ID を貼り付けて保存します（ブラウザの LocalStorage に安全に記憶されます）。

---

## ファイル構成

```
ga4-yomiyasui/
├── index.html       # マークアップ (セマンティック HTML5)
├── style.css        # スタイル (モダン生 CSS、CSS変数、Grid/Flexbox)
├── app.js           # ロジック (状態管理、GIS認可、API通信、結論文生成、Chart.js制御)
├── demo-data.json   # デモ用モックデータ
├── queries.json     # Data API クエリ定義
├── LICENSE          # MIT License
└── README.md        # 本書
```

---

## 参考（公式仕様）

- [Google Analytics Data API Quickstart](https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart)
- [API Dimensions & Metrics Schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [Google Identity Services (GIS) Reference](https://developers.google.com/identity/oauth2/web/guides/overview)
- [Google Analytics Data API Quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)

---

## ライセンス

[MIT License](LICENSE)
