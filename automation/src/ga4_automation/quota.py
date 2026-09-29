"""クォータチェック機能 - importエラー対策版"""
import time
from typing import Dict, Optional


class QuotaChecker:
    """
    API呼び出しレート制限チェック
    
    check_quotasという名前でimportされることを想定
    """
    
    def __init__(self, calls_per_day: int = 50000):
        self.calls_per_day = calls_per_day
        self.calls_made = 0
        self.last_reset = time.time()
        
    def check(self) -> bool:
        """クォータをチェックし、超過していればFalseを返す"""
        now = time.time()
        
        if now - self.last_reset > 86400:
            self.calls_made = 0
            self.last_reset = now
            
        return self.calls_made < self.calls_per_day
    
    def record_call(self):
        """API呼び出しを記録"""
        self.calls_made += 1
        
    def get_stats(self) -> Dict[str, int]:
        """現在の使用状況を返す"""
        return {
            "calls_made": self.calls_made,
            "calls_remaining": max(0, self.calls_per_day - self.calls_made),
            "limit": self.calls_per_day,
        }


# パッケージレベルでimport可能にする
check_quotas = QuotaChecker()
