"use client";

import { useState, useEffect } from "react";

const API = "/api/proxy";

interface Settings {
  max_usages: number;
  min_snippet_len: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    max_usages: 25,
    min_snippet_len: 15,
  });
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API}/settings`);
      const data = await res.json();
      setSettings({
        max_usages: data.max_usages ?? 25,
        min_snippet_len: data.min_snippet_len ?? 15,
      });
    } catch (e) {
      console.error("加载设置失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage("");

    try {
      const res = await fetch(`${API}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage("✅ 设置已保存");
      } else {
        setMessage("❌ 保存失败");
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">系统设置</h1>
        <p className="mt-1 text-muted-foreground">配置词语处理的核心参数</p>
      </header>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl animate-slideIn ${
            message.startsWith("✅") ? "bg-green-500/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* 处理参数卡片 */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              ⚙️
            </div>
            <div>
              <h2 className="text-lg font-semibold text-card-foreground">处理参数</h2>
              <p className="text-xs text-muted-foreground">控制 LLM 处理词语时的行为</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">最大用例数</label>
                <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                  {settings.max_usages}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={50}
                value={settings.max_usages}
                onChange={(e) => setSettings({ ...settings, max_usages: parseInt(e.target.value) })}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1</span>
                <span>每个词条最多保留的用例数量</span>
                <span>50</span>
              </div>
            </div>

            <div className="divider" />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">最短片段长度</label>
                <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                  {settings.min_snippet_len}
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                value={settings.min_snippet_len}
                onChange={(e) => setSettings({ ...settings, min_snippet_len: parseInt(e.target.value) })}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>5</span>
                <span>语料片段的最小字符数，过短的片段将被过滤</span>
                <span>100</span>
              </div>
            </div>
          </div>
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-gradient px-8 py-3 rounded-xl font-medium disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}
