"""設定管理テスト - property_id永続化確認"""
import pytest
import tempfile
import os
from pathlib import Path
from ga4_automation.config import Config


def test_config_persist_property_id():
    """
    プロパティ作成後のID永続化
    
    CREATE操作後に property_id が YAML に保存されることを確認
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = os.path.join(tmpdir, 'test_config.yaml')
        config = Config(config_path)
        
        config.persist_property_id(
            property_id='123456789',
            property_name='properties/123456789'
        )
        
        # 新しいインスタンスで読み込み直して確認
        config2 = Config(config_path)
        assert config2.get_property_id() == '123456789'
        assert config2.get('property_name') == 'properties/123456789'


def test_config_load_save():
    """基本的な読み書き"""
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = os.path.join(tmpdir, 'test_config.yaml')
        config = Config(config_path)
        
        config.set('test_key', 'test_value')
        config.save()
        
        config2 = Config(config_path)
        assert config2.get('test_key') == 'test_value'
