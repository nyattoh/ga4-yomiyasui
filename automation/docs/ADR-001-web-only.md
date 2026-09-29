# ADR-001: WEBデータストリームのみサポート

## ステータス

採用済み

## コンテキスト

GA4では以下の3種類のデータストリームを作成できます:

- **WEBデータストリーム**: Webサイト向け（Googleタグ経由）
- **iOSアプリストリーム**: iOSアプリ向け（Firebase SDK経由）
- **Androidアプリストリーム**: Androidアプリ向け（Firebase SDK経由）

本プロジェクトの目的は「GA4 よみやすい」フロントエンド（Webアプリ）のバックエンド自動化であり、対象ユーザーはWebサイト運営者です。

## 決定

**WEBデータストリームのみをサポートします。**

iOS/Androidストリーム作成を試みた場合、`NotImplementedError` を発生させ、明示的にエラー通知します（fail-loud）。

## 理由

1. **対象ユーザーの明確化**
   - 本CLIはWebサイト向けGA4設定の自動化に特化
   - モバイルアプリ開発者は対象外

2. **実装コストの削減**
   - iOS/Androidストリームは Firebase SDK や App ID が必要で、設定フローが複雑
   - Web向け機能を早期リリースすることを優先

3. **fail-loud設計**
   - サポート外の操作を試みた場合、明示的にエラーで通知
   - 「なぜか動かない」よりも「未サポートです」の方がユーザーフレンドリー

## 実装

`client.py` の `create_data_stream` メソッドで以下をチェック:

```python
if stream_type != "WEB":
    raise NotImplementedError(
        f"ストリームタイプ '{stream_type}' は未サポートです。"
        f"WEBストリームのみ対応しています。"
        f"iOS/Androidストリームが必要な場合は実装を追加してください。"
    )
```

## 影響

### 正の影響

- コードがシンプルで保守しやすい
- Webサイト向けユースケースに集中できる
- エラーメッセージが明確

### 負の影響

- モバイルアプリ開発者は使えない
- 将来的にiOS/Android対応を追加する場合、APIの拡張が必要

## 今後の対応

モバイルアプリ向けストリーム作成が必要になった場合:

1. `stream_type="IOS"` または `"ANDROID"` のサポートを追加
2. Firebase連携の認証フローを実装
3. App ID、Bundle ID 等の追加パラメータに対応
4. 本ADRをUpdateし、新しい設計判断を記録

## 関連

- [GA4 Data Streams API](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties.dataStreams)
- [Firebase SDK for GA4](https://firebase.google.com/docs/analytics)
