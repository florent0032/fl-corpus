"""插件系统 - 后处理模块

提供可扩展的后处理插件架构，用于对已处理的词条进行增强。
例如：填充缺失的声调、补充词性、格式化输出等。

用法:
    from backend.plugins import plugin_registry, run_plugin

    # 获取所有可用插件
    plugins = plugin_registry.list_plugins()

    # 运行指定插件
    result = await run_plugin("accent_filler", entries, config)
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Callable
from datetime import datetime
from loguru import logger


class PluginResult:
    """插件执行结果"""

    def __init__(self, plugin_id: str):
        self.plugin_id = plugin_id
        self.success = 0
        self.failed = 0
        self.skipped = 0
        self.errors: list[str] = []
        self.started_at = datetime.now().isoformat()
        self.finished_at: str | None = None

    def finish(self):
        self.finished_at = datetime.now().isoformat()

    def to_dict(self) -> dict:
        return {
            "plugin_id": self.plugin_id,
            "success": self.success,
            "failed": self.failed,
            "skipped": self.skipped,
            "errors": self.errors[-20:],  # 只保留最近20条错误
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }


class BasePlugin(ABC):
    """插件基类"""

    @property
    @abstractmethod
    def id(self) -> str:
        """插件唯一标识"""
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """插件显示名称"""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """插件描述"""
        ...

    @property
    def supported_languages(self) -> list[str]:
        """支持的语言列表，空列表表示支持所有语言"""
        return []

    @property
    def target_field(self) -> str:
        """此插件主要填充的字段名"""
        return ""

    @abstractmethod
    async def process_entry(self, entry: dict, config: dict) -> dict:
        """处理单个词条

        Args:
            entry: 词条数据（已处理的词条格式）
            config: 插件配置

        Returns:
            修改后的词条数据
        """
        ...

    def should_process(self, entry: dict) -> bool:
        """判断是否需要处理此词条

        默认实现：检查 target_field 是否为空

        Args:
            entry: 词条数据

        Returns:
            是否需要处理
        """
        if not self.target_field:
            return True
        current = entry.get(self.target_field, "")
        return not current or not str(current).strip()


class PluginRegistry:
    """插件注册表"""

    def __init__(self):
        self._plugins: dict[str, BasePlugin] = {}

    def register(self, plugin: BasePlugin):
        """注册插件"""
        self._plugins[plugin.id] = plugin
        logger.info(f"插件已注册: {plugin.id} ({plugin.name})")

    def get_plugin(self, plugin_id: str) -> BasePlugin | None:
        """获取插件"""
        return self._plugins.get(plugin_id)

    def list_plugins(self) -> list[dict]:
        """列出所有插件"""
        return [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "supported_languages": p.supported_languages,
                "target_field": p.target_field,
            }
            for p in self._plugins.values()
        ]


# 全局插件注册表
plugin_registry = PluginRegistry()


async def run_plugin(
    plugin_id: str,
    entries: list[dict],
    config: dict | None = None,
    progress_callback: Callable | None = None,
) -> PluginResult:
    """运行插件处理词条列表

    Args:
        plugin_id: 插件 ID
        entries: 词条列表
        config: 插件配置
        progress_callback: 进度回调函数 (processed, total, current_word)

    Returns:
        处理结果
    """
    plugin = plugin_registry.get_plugin(plugin_id)
    if not plugin:
        raise ValueError(f"插件不存在: {plugin_id}")

    config = config or {}
    result = PluginResult(plugin_id)
    total = len(entries)

    for i, entry in enumerate(entries):
        try:
            # 检查是否需要处理
            if not plugin.should_process(entry):
                result.skipped += 1
                continue

            # 处理词条
            word = entry.get("word", "")
            if progress_callback:
                progress_callback(i + 1, total, word)

            processed = await plugin.process_entry(entry, config)

            # 更新词条
            entry.update(processed)
            result.success += 1

        except Exception as e:
            error_msg = f"{entry.get('word', '?')}: {e}"
            result.errors.append(error_msg)
            result.failed += 1
            logger.warning(f"插件 {plugin_id} 处理失败: {error_msg}")

    result.finish()
    return result


def _auto_discover_plugins():
    """自动发现并注册插件"""
    from backend.plugins.accent_filler import AccentFillerPlugin

    plugin_registry.register(AccentFillerPlugin())


# 自动发现插件
_auto_discover_plugins()
