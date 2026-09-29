"""設定ファイル管理 - property_id永続化対応"""
import yaml
from pathlib import Path
from typing import Dict, Any, Optional


class Config:
    """
    YAML設定ファイルの読み書き
    
    プロパティ作成後、property_idを自動保存する
    """
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = Path(config_path)
        self.data: Dict[str, Any] = {}
        
        if self.config_path.exists():
            self.load()
    
    def load(self):
        """YAML読み込み"""
        with open(self.config_path, 'r', encoding='utf-8') as f:
            self.data = yaml.safe_load(f) or {}
    
    def save(self):
        """YAML保存"""
        with open(self.config_path, 'w', encoding='utf-8') as f:
            yaml.dump(self.data, f, allow_unicode=True, default_flow_style=False)
    
    def get(self, key: str, default: Any = None) -> Any:
        """設定値取得"""
        return self.data.get(key, default)
    
    def set(self, key: str, value: Any):
        """設定値更新"""
        self.data[key] = value
    
    def persist_property_id(self, property_id: str, property_name: str):
        """
        プロパティ作成後、IDを永続化
        
        CREATE操作後に自動的に呼び出す
        """
        self.data['property_id'] = property_id
        self.data['property_name'] = property_name
        self.save()
    
    def get_property_id(self) -> Optional[str]:
        """保存されているproperty_idを取得"""
        return self.data.get('property_id')
