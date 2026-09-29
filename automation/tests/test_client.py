"""クライアントテスト - WEBストリーム限定確認"""
import pytest
from ga4_automation.client import GA4Client


def test_non_web_stream_raises_not_implemented():
    """
    iOSやAndroidストリーム作成時はNotImplementedErrorで fail-loud
    
    WEB以外のストリームタイプは未実装であることを明示的にエラーで通知
    """
    client = GA4Client()
    
    with pytest.raises(NotImplementedError) as exc_info:
        client.create_data_stream(
            property_id="123456",
            display_name="iOS App",
            stream_type="IOS",
        )
    
    assert "未サポート" in str(exc_info.value)
    assert "WEB" in str(exc_info.value)


def test_android_stream_not_supported():
    """Androidストリームも未サポート"""
    client = GA4Client()
    
    with pytest.raises(NotImplementedError) as exc_info:
        client.create_data_stream(
            property_id="123456",
            display_name="Android App",
            stream_type="ANDROID",
        )
    
    assert "未サポート" in str(exc_info.value)
