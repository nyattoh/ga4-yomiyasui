# Understood Errors & Failure Modes

## Error Patterns

### Windows Global `pytest.exe` Launcher Mismatch
- **Cause**: Windows PATH points to an older Python installation's script (`C:\Users\ryoko\AppData\Roaming\Python\Python310\Scripts\pytest.exe`), causing `Fatal error in launcher: Unable to create process`.
- **Solution**: Always execute pytest through the active Python interpreter: `python -m pytest -v`.
- **Prevention**: Document `python -m pytest` in README and CI/CD scripts.

### Missing Credentials JSON on First Run
- **Cause**: Running with `-k credentials.json` when the file has not yet been placed on disk causes Click path validation failure.
- **Solution**: Added `--offline` flag to `plan_command` for offline simulation, and improved CLI messaging to suggest `--offline` when credentials are not found.
- **Prevention**: Allow local schema, plan diff simulation, and quota guardrails to be fully testable without Google Cloud keys.

### GA4 Custom Dimension Parameter Immutability
- **Cause**: GA4 Admin API does not allow changing the `parameter_name` or `scope` of an existing custom dimension once created.
- **Solution**: Check if a dimension with the same `parameter_name` and `scope` already exists before trying to create. Only update `display_name` or `description`.
- **Prevention**: Use the diff engine to match by `parameter_name` + `scope` as the unique composite key, rather than by `display_name`.

### GA4 Resource Name Format
- **Cause**: GA4 Admin API requires property names in the format `properties/{property_id}` and account names as `accounts/{account_id}`.
- **Solution**: Normalize property IDs so users can specify either `12345678` or `properties/12345678`.
- **Prevention**: Add an input normalizer in client wrappers and Pydantic models.

## Known Failure Modes

### Quota Overflow during Bulk Creation
- **What looks correct**: Creating 60 custom dimensions in a loop and catching 429 / 400 errors as they happen.
- **Why it's wrong**: Leaves the GA4 property in a half-configured state; difficult to roll back or know which ones succeeded.
- **Correct approach**: Validate total count against GA4 tier quotas (Standard: 50 event-scoped, 25 user-scoped) during the `plan` phase before issuing any API writes.

### Frontend DOM and Chart Stale State on Property Switch (Early Return with Empty Data)
- **What looks correct**: `if (!channelRows || channelRows.length === 0) return;` でデータがないときは描画をスキップする。
- **Why it's wrong**: ユーザーが別のサイト（アクセスが少ないサイトや新規作成サイト）に切り替えた際、前のサイトのDOMテーブル、結論文、Chart.js のキャンバスがそのまま残存し、「サイト変更したのに前のデータが残っている」という深刻なUIバグになる。
- **Correct approach**:
  1. プロパティや期間の切り替え時に直ちに全項目をローディング状態にする `resetViewToLoading()` を実行する。
  2. 描画関数ではデータが0件（空配列・null）の場合でも古いChartインスタンスを確実に `destroy` し、表や結論文に「まだデータがありません（0件）」と明示的に空状態（Empty State）を描画する。
  3. `Promise.all` ではなく各クエリを安全にフォールバック（`runReportSafe`）し、特定ディメンションの取得失敗で全体が中断して画面がフリーズするのを防ぐ。
