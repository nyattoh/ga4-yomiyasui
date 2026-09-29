"""GA4 API エラー定義"""


class GA4Error(Exception):
    """GA4 API エラーの基底クラス"""
    pass


class GA4NotFoundError(GA4Error):
    """リソースが見つからない (404)"""
    pass


class GA4PermissionError(GA4Error):
    """権限エラー (403)"""
    pass


class GA4QuotaError(GA4Error):
    """クォータ超過エラー (429)"""
    pass


def classify_api_error(error: Exception) -> Exception:
    """
    Google API エラーを適切なGA4Errorサブクラスに分類
    
    NotFoundエラーと他のエラーを明確に区別する
    """
    error_str = str(error).lower()
    
    if "not found" in error_str or "404" in error_str:
        return GA4NotFoundError(str(error))
    elif "permission" in error_str or "403" in error_str:
        return GA4PermissionError(str(error))
    elif "quota" in error_str or "429" in error_str:
        return GA4QuotaError(str(error))
    else:
        return GA4Error(str(error))
