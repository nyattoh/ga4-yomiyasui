"""CLI エントリーポイント"""
import sys
import argparse
from typing import List

from .client import GA4Client
from .config import Config
from .errors import GA4Error, GA4NotFoundError, GA4PermissionError


def main(argv: List[str] = None):
    """メインCLI"""
    if argv is None:
        argv = sys.argv[1:]
        
    parser = argparse.ArgumentParser(
        description="GA4自動セットアップCLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    
    subparsers = parser.add_subparsers(dest='command', help='サブコマンド')
    
    # setup コマンド
    setup_parser = subparsers.add_parser('setup', help='プロパティ・ストリーム・キーイベントを作成')
    setup_parser.add_argument('--account-id', required=True, help='GAアカウントID')
    setup_parser.add_argument('--name', required=True, help='プロパティ名')
    setup_parser.add_argument('--url', required=True, help='WebサイトURL')
    setup_parser.add_argument('--config', default='config.yaml', help='設定ファイルパス')
    
    # list-accounts コマンド
    list_parser = subparsers.add_parser('list-accounts', help='アカウント一覧表示')
    
    args = parser.parse_args(argv)
    
    if not args.command:
        parser.print_help()
        return 1
    
    try:
        client = GA4Client()
        client.authenticate()
        
        if args.command == 'setup':
            config = Config(args.config)
            
            print(f"プロパティ作成中: {args.name}")
            prop = client.create_property(
                account_id=args.account_id,
                display_name=args.name,
            )
            print(f"✓ プロパティ作成完了: {prop['property_id']}")
            
            config.persist_property_id(prop['property_id'], prop['property_name'])
            print(f"✓ property_idを {args.config} に保存しました")
            
            print(f"\nデータストリーム作成中...")
            stream = client.create_data_stream(
                property_id=prop['property_id'],
                display_name=f"{args.name} - ウェブ",
                stream_type="WEB",
                web_url=args.url,
            )
            print(f"✓ ストリーム作成完了: {stream['measurement_id']}")
            
            print(f"\nキーイベント作成中...")
            for event_name in ['form_submit', 'file_download']:
                try:
                    key_event = client.create_key_event(
                        property_id=prop['property_id'],
                        event_name=event_name,
                    )
                    print(f"✓ キーイベント作成: {event_name}")
                except GA4Error as e:
                    print(f"⚠ {event_name} 作成スキップ: {e}")
            
            print(f"\n🎉 セットアップ完了！")
            print(f"測定ID: {stream['measurement_id']}")
            
        elif args.command == 'list-accounts':
            accounts = client.list_accounts()
            print("利用可能なアカウント:")
            for acc in accounts:
                print(f"  - {acc['display_name']} (ID: {acc['account_id']})")
        
        return 0
        
    except GA4NotFoundError as e:
        print(f"❌ リソースが見つかりません: {e}", file=sys.stderr)
        return 1
    except GA4PermissionError as e:
        print(f"❌ 権限エラー: {e}", file=sys.stderr)
        return 1
    except GA4Error as e:
        print(f"❌ GA4 API エラー: {e}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"❌ 予期しないエラー: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
