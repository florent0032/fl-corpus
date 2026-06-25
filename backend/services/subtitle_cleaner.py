"""字幕格式清理器

支持多种字幕格式：
- ASS/SSA (Advanced SubStation Alpha)
- SRT (SubRip)
- VTT (WebVTT)
- TXT (纯文本)
"""

import re
from typing import List


class SubtitleCleaner:
    """字幕格式清理器"""

    @staticmethod
    def detect_format(content: str) -> str:
        """检测字幕格式"""
        if '[Script Info]' in content or '[V4+ Styles]' in content:
            return 'ass'
        elif 'WEBVTT' in content:
            return 'vtt'
        elif re.search(r'\d+\r?\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}', content):
            return 'srt'
        else:
            return 'txt'

    @staticmethod
    def clean_ass(content: str) -> str:
        """清理 ASS/SSA 格式"""
        lines = content.split('\n')
        cleaned_lines = []

        for line in lines:
            line = line.strip()

            # 跳过元数据
            if not line:
                continue
            if line.startswith('[') and line.endswith(']'):
                continue
            if line.startswith(';'):
                continue
            if line.startswith('Script'):
                continue
            if line.startswith('Title:'):
                continue
            if line.startswith('WrapStyle:'):
                continue
            if line.startswith('PlayRes'):
                continue
            if line.startswith('ScaledBorder'):
                continue
            if line.startswith('Video'):
                continue
            if line.startswith('Audio'):
                continue
            if line.startswith('Last Style'):
                continue
            if line.startswith('Active Line'):
                continue
            if line.startswith('Scroll Position'):
                continue
            if line.startswith('Video AR'):
                continue
            if line.startswith('Video Zoom'):
                continue
            if line.startswith('Format:') and 'Name, Fontname' in line:
                continue
            if line.startswith('Style:'):
                continue
            if line.startswith('Fontsize'):
                continue

            # 跳过 Drawing 命令
            if re.match(r'^[ml]\s+[-\d.\s]+$', line):
                continue

            # 处理 Dialogue 行
            if line.startswith('Dialogue:'):
                parts = line.split(',', 9)
                if len(parts) >= 10:
                    text = parts[9]
                    # 去除 ASS 格式代码 {...}
                    text = re.sub(r'\{[^}]*\}', '', text)
                    # 去除换行符
                    text = text.replace('\\N', ' ').replace('\\n', ' ')
                    # 去除多余空白
                    text = re.sub(r'\s+', ' ', text).strip()
                    if text and len(text) > 1:
                        cleaned_lines.append(text)

        return '\n'.join(cleaned_lines)

    @staticmethod
    def clean_srt(content: str) -> str:
        """清理 SRT 格式"""
        lines = content.split('\n')
        cleaned_lines = []

        for line in lines:
            line = line.strip()

            # 跳过序号
            if re.match(r'^\d+$', line):
                continue

            # 跳过时间戳
            if re.match(r'\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}', line):
                continue

            # 跳过空行
            if not line:
                continue

            # 去除 HTML 标签
            line = re.sub(r'<[^>]+>', '', line)

            # 去除 SRT 格式标签
            line = re.sub(r'\{\\[^}]+\}', '', line)

            if line and len(line) > 1:
                cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)

    @staticmethod
    def clean_vtt(content: str) -> str:
        """清理 VTT 格式"""
        lines = content.split('\n')
        cleaned_lines = []

        for line in lines:
            line = line.strip()

            # 跳过 WEBVTT 头
            if line.startswith('WEBVTT'):
                continue

            # 跻过 NOTE
            if line.startswith('NOTE'):
                continue

            # 跳过时间戳
            if re.match(r'\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}', line):
                continue

            # 跳过空行
            if not line:
                continue

            # 去除 HTML 标签
            line = re.sub(r'<[^>]+>', '', line)

            if line and len(line) > 1:
                cleaned_lines.append(line)

        return '\n'.join(cleaned_lines)

    @classmethod
    def clean(cls, content: str, format_hint: str = None) -> str:
        """清理字幕内容

        Args:
            content: 原始字幕内容
            format_hint: 格式提示（ass, srt, vtt, txt）

        Returns:
            清理后的纯文本
        """
        if not content:
            return ""

        # 检测格式
        if format_hint:
            fmt = format_hint.lower()
        else:
            fmt = cls.detect_format(content)

        # 根据格式选择清理方法
        if fmt == 'ass':
            return cls.clean_ass(content)
        elif fmt == 'srt':
            return cls.clean_srt(content)
        elif fmt == 'vtt':
            return cls.clean_vtt(content)
        else:
            # 纯文本，只做基本清理
            return content.strip()

    @classmethod
    def clean_and_split_sentences(cls, content: str, format_hint: str = None) -> List[str]:
        """清理并分割句子

        Args:
            content: 原始字幕内容
            format_hint: 格式提示

        Returns:
            句子列表
        """
        cleaned = cls.clean(content, format_hint)
        if not cleaned:
            return []

        # 按行分割
        lines = cleaned.split('\n')

        # 过滤掉太短的行
        sentences = [line.strip() for line in lines if len(line.strip()) > 2]

        return sentences


# 全局实例
subtitle_cleaner = SubtitleCleaner()
