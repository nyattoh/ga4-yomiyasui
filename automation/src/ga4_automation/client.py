"""GA4 Admin API クライアント"""
import os
from typing import Dict, Optional, List
from google.analytics.admin import AnalyticsAdminServiceClient
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

from .errors import classify_api_error, GA4NotFoundError, GA4PermissionError
from .quota import check_quotas


SCOPES = ['https://www.googleapis.com/auth/analytics.edit']


class GA4Client:
    """
    GA4 Admin API ラッパー
    
    - NotFound vs 他のエラーを明確に区別
    - プロパティID永続化対応
    - WEBストリームのみサポート（iOS/Androidはfail-loud）
    """
    
    def __init__(self, credentials_path: str = "credentials.json"):
        self.credentials_path = credentials_path
        self.client: Optional[AnalyticsAdminServiceClient] = None
        
    def authenticate(self, token_path: str = "token.json"):
        """OAuth認証実行"""
        creds = None
        
        if os.path.exists(token_path):
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
            
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_path):
                    raise FileNotFoundError(
                        f"認証情報ファイルが見つかりません: {self.credentials_path}"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES
                )
                creds = flow.run_local_server(port=0)
                
            with open(token_path, 'w') as token:
                token.write(creds.to_json())
                
        self.client = AnalyticsAdminServiceClient(credentials=creds)
        return self
    
    def create_property(
        self, 
        account_id: str,
        display_name: str,
        time_zone: str = "Asia/Tokyo",
        currency_code: str = "JPY"
    ) -> Dict[str, str]:
        """
        GA4プロパティを作成
        
        Returns:
            property_id, property_nameを含む辞書
        """
        if not self.client:
            raise RuntimeError("authenticate()を先に実行してください")
            
        if not check_quotas.check():
            raise GA4PermissionError("APIクォータを超過しています")
            
        try:
            from google.analytics.admin_v1alpha.types import Property
            
            property = Property(
                parent=f"accounts/{account_id}",
                display_name=display_name,
                time_zone=time_zone,
                currency_code=currency_code,
            )
            
            response = self.client.create_property(property=property)
            check_quotas.record_call()
            
            property_id = response.name.split("/")[-1]
            
            return {
                "property_id": property_id,
                "property_name": response.name,
                "display_name": response.display_name,
            }
            
        except Exception as e:
            raise classify_api_error(e)
    
    def create_data_stream(
        self,
        property_id: str,
        display_name: str,
        stream_type: str = "WEB",
        web_url: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        データストリームを作成
        
        Args:
            stream_type: "WEB"のみサポート。iOS/Androidは未実装でエラー
        
        Returns:
            stream_id, measurement_idを含む辞書
        """
        if stream_type != "WEB":
            raise NotImplementedError(
                f"ストリームタイプ '{stream_type}' は未サポートです。"
                f"WEBストリームのみ対応しています。"
                f"iOS/Androidストリームが必要な場合は実装を追加してください。"
            )
            
        if not web_url:
            raise ValueError("WEBストリームにはweb_urlが必要です")
            
        if not self.client:
            raise RuntimeError("authenticate()を先に実行してください")
            
        if not check_quotas.check():
            raise GA4PermissionError("APIクォータを超過しています")
            
        try:
            from google.analytics.admin_v1alpha.types import DataStream, WebStreamData
            
            stream = DataStream(
                display_name=display_name,
                type_=DataStream.DataStreamType.WEB_DATA_STREAM,
                web_stream_data=WebStreamData(default_uri=web_url),
            )
            
            parent = f"properties/{property_id}"
            response = self.client.create_data_stream(parent=parent, data_stream=stream)
            check_quotas.record_call()
            
            return {
                "stream_id": response.name.split("/")[-1],
                "stream_name": response.name,
                "measurement_id": response.web_stream_data.measurement_id,
            }
            
        except Exception as e:
            raise classify_api_error(e)
    
    def create_key_event(
        self,
        property_id: str,
        event_name: str,
    ) -> Dict[str, str]:
        """キーイベント作成"""
        if not self.client:
            raise RuntimeError("authenticate()を先に実行してください")
            
        if not check_quotas.check():
            raise GA4PermissionError("APIクォータを超過しています")
            
        try:
            from google.analytics.admin_v1alpha.types import KeyEvent
            
            key_event = KeyEvent(
                event_name=event_name,
                counting_method=KeyEvent.CountingMethod.ONCE_PER_SESSION,
            )
            
            parent = f"properties/{property_id}"
            response = self.client.create_key_event(parent=parent, key_event=key_event)
            check_quotas.record_call()
            
            return {
                "key_event_name": response.name,
                "event_name": response.event_name,
            }
            
        except Exception as e:
            raise classify_api_error(e)
    
    def list_accounts(self) -> List[Dict[str, str]]:
        """アカウント一覧取得"""
        if not self.client:
            raise RuntimeError("authenticate()を先に実行してください")
            
        try:
            accounts = []
            for account in self.client.list_accounts():
                accounts.append({
                    "account_id": account.name.split("/")[-1],
                    "account_name": account.name,
                    "display_name": account.display_name,
                })
            return accounts
            
        except Exception as e:
            raise classify_api_error(e)
