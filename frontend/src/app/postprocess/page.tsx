"use client";

import { useState, useEffect } from "react";

const API = "/api/proxy";

interface Plugin {
  id: string;
  name: string;
  description: string;
  supported_languages: string[];
  target_field: string;
}

interface PluginStatus {
  running: boolean;
  plugin_id: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  current_word: string;
  errors: string[];
  started_at: string | null;
  finished_at: string | null;
}

interface Language {
  code: string;
  name: string;
  collections: { id: string; name: string; desc: string }[];
}

const LANG_NAMES: Record<string, string> = {
  ja: "日语",
  ar: "阿拉伯语",
  ko: "韩语",
  fa: "波斯语",
  es: "西班牙语",
};

export default function PostProcessPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [status, setStatus] = useState<PluginStatus | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");

  // 配置状态
  const [selectedPlugin, setSelectedPlugin] = useState("");
  const [selectedLang, setSelectedLang] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [delay, setDelay] = useState(0.3);
  const [useCache, setUseCache] = useState(true);
  const [force, setForce] = useState(false);

  useEffect(() => {
    loadPlugins();
    loadLanguages();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (status?.running) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/plugins/status`);
          const data = await res.json();
          setStatus(data);

          if (!data.running) {
            setMessage("✅ 插件执行完成");
          }
        } catch (e) {
          console.error("获取状态失败:", e);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [status?.running]);

  const loadPlugins = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/plugins`);
      const data = await res.json();
      setPlugins(data.items || []);

      if (data.items?.length > 0) {
        setSelectedPlugin(data.items[0].id);
      }
    } catch (e) {
      console.error("加载插件失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLanguages = async () => {
    try {
      const res = await fetch(`${API}/languages`);
      const data = await res.json();
      setLanguages(data.items || []);
    } catch (e) {
      console.error("加载语言失败:", e);
    }
  };

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API}/plugins/status`);
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      console.error("获取状态失败:", e);
    }
  };

  const handleRun = async () => {
    if (!selectedPlugin) {
      setMessage("❌ 请选择插件");
      return;
    }

    setMessage("");
    const params = new URLSearchParams();
    if (selectedCollection) params.set("collection_id", selectedCollection);
    if (selectedLang) params.set("lang", selectedLang);
    params.set("delay", String(delay));
    params.set("use_cache", String(useCache));
    params.set("force", String(force));

    try {
      const res = await fetch(`${API}/plugins/${selectedPlugin}/run?${params}`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        // 开始轮询状态
        setTimeout(loadStatus, 500);
      } else {
        setMessage(`❌ ${data.message || data.detail}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleStop = async () => {
    try {
      await fetch(`${API}/plugins/stop`, { method: "POST" });
      setMessage("已发送停止信号");
    } catch (e) {
      console.error("停止失败:", e);
    }
  };

  const currentPlugin = plugins.find((p) => p.id === selectedPlugin);
  const currentLang = languages.find((l) => l.code === selectedLang);
  const collections = currentLang?.collections || [];

  const progress = status
    ? status.total > 0
      ? (status.processed / status.total) * 100
      : 0
    : 0;

  return (
    <div className="container mx-auto px-6 py-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">后处理插件</h1>
        <p className="mt-1 text-muted-foreground">
          对已处理的词条进行后处理增强，如填充缺失的声调信息
        </p>
      </header>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl animate-slideIn ${
            message.startsWith("✅")
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : message.startsWith("❌")
              ? "bg-red-500/10 text-red-500 border border-red-500/20"
              : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
          }`}
        >
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：配置面板 */}
          <div className="space-y-6">
            {/* 插件选择 */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  🧩
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">选择插件</h2>
                  <p className="text-xs text-muted-foreground">选择要运行的后处理插件</p>
                </div>
              </div>

              <div className="space-y-4">
                {plugins.map((plugin) => (
                  <label
                    key={plugin.id}
                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all border ${
                      selectedPlugin === plugin.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="plugin"
                      value={plugin.id}
                      checked={selectedPlugin === plugin.id}
                      onChange={(e) => setSelectedPlugin(e.target.value)}
                      className="mt-1 accent-primary"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-card-foreground">{plugin.name}</div>
                      <p className="text-sm text-muted-foreground mt-1">{plugin.description}</p>
                      <div className="flex gap-2 mt-2">
                        {plugin.supported_languages.length > 0 ? (
                          plugin.supported_languages.map((lang) => (
                            <span key={lang} className="badge badge-primary text-xs">
                              {LANG_NAMES[lang] || lang}
                            </span>
                          ))
                        ) : (
                          <span className="badge badge-primary text-xs">所有语言</span>
                        )}
                        {plugin.target_field && (
                          <span className="badge text-xs" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.2)" }}>
                            → {plugin.target_field}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 筛选配置 */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                  🔍
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">筛选条件</h2>
                  <p className="text-xs text-muted-foreground">选择要处理的词条范围</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1.5 text-muted-foreground">语言</label>
                  <select
                    value={selectedLang}
                    onChange={(e) => {
                      setSelectedLang(e.target.value);
                      setSelectedCollection("");
                    }}
                    className="select w-full"
                  >
                    <option value="">所有语言</option>
                    {languages.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>

                {selectedLang && collections.length > 0 && (
                  <div>
                    <label className="block text-sm mb-1.5 text-muted-foreground">词语库</label>
                    <select
                      value={selectedCollection}
                      onChange={(e) => setSelectedCollection(e.target.value)}
                      className="select w-full"
                    >
                      <option value="">所有词语库</option>
                      {collections.map((col) => (
                        <option key={col.id} value={col.id}>{col.name} - {col.desc}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* 插件配置 */}
            {currentPlugin?.id === "accent_filler" && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    ⚙️
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-card-foreground">插件配置</h2>
                    <p className="text-xs text-muted-foreground">声调填充插件的参数</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-foreground">请求延迟</label>
                      <span className="text-sm font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                        {delay}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={delay}
                      onChange={(e) => setDelay(parseFloat(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      对 OJAD 的请求间隔，过快可能被限流
                    </p>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCache}
                      onChange={(e) => setUseCache(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <div>
                      <span className="text-sm text-foreground">使用缓存</span>
                      <p className="text-xs text-muted-foreground">已查询过的单词不会重复请求</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={force}
                      onChange={(e) => setForce(e.target.checked)}
                      className="w-4 h-4 rounded accent-primary"
                    />
                    <div>
                      <span className="text-sm text-foreground">强制覆盖</span>
                      <p className="text-xs text-muted-foreground">覆盖已有的声调数据</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-4">
              {!status?.running ? (
                <button
                  onClick={handleRun}
                  disabled={!selectedPlugin}
                  className="btn-gradient flex-1 px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🚀 运行插件
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex-1 px-6 py-3 rounded-xl font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
                >
                  ⏹️ 停止
                </button>
              )}
            </div>
          </div>

          {/* 右侧：执行状态 */}
          <div className="space-y-6">
            {/* 状态卡片 */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                  📊
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">执行状态</h2>
                  <p className="text-xs text-muted-foreground">
                    {status?.running
                      ? `正在运行: ${plugins.find((p) => p.id === status.plugin_id)?.name || status.plugin_id}`
                      : status?.finished_at
                      ? "上次执行完成"
                      : "等待执行"}
                  </p>
                </div>
              </div>

              {status && status.total > 0 ? (
                <div className="space-y-4">
                  {/* 进度条 */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">总体进度</span>
                      <span className="text-foreground">
                        {status.processed} / {status.total}
                      </span>
                    </div>
                    <div className="progress-bar h-4">
                      <div
                        className="progress-fill h-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-right text-sm mt-1 text-muted-foreground">
                      {progress.toFixed(1)}%
                    </div>
                  </div>

                  {/* 统计数据 */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="card p-4 text-center bg-green-500/5 border-green-500/20">
                      <div className="text-2xl font-bold text-green-500">{status.success}</div>
                      <div className="text-sm text-muted-foreground">成功</div>
                    </div>
                    <div className="card p-4 text-center bg-yellow-500/5 border-yellow-500/20">
                      <div className="text-2xl font-bold text-yellow-500">{status.skipped}</div>
                      <div className="text-sm text-muted-foreground">跳过</div>
                    </div>
                    <div className="card p-4 text-center bg-red-500/5 border-red-500/20">
                      <div className="text-2xl font-bold text-red-500">{status.failed}</div>
                      <div className="text-sm text-muted-foreground">失败</div>
                    </div>
                  </div>

                  {/* 当前处理 */}
                  {status.running && status.current_word && (
                    <div className="card p-4 border-l-4 border-primary">
                      <div className="text-sm text-muted-foreground">正在处理</div>
                      <div className="text-lg font-medium text-card-foreground">
                        {status.current_word}
                      </div>
                    </div>
                  )}

                  {/* 错误列表 */}
                  {status.errors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                        最近错误 ({status.errors.length})
                      </h3>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {status.errors.slice(-5).map((error, i) => (
                          <div
                            key={i}
                            className="card p-3 text-sm border-l-4 border-red-500 text-red-500"
                          >
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 时间信息 */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    {status.started_at && (
                      <div>开始时间: {new Date(status.started_at).toLocaleString()}</div>
                    )}
                    {status.finished_at && (
                      <div>完成时间: {new Date(status.finished_at).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🧩</div>
                  <p className="text-muted-foreground">尚未执行任何插件</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    选择插件并点击"运行插件"开始
                  </p>
                </div>
              )}
            </div>

            {/* 使用说明 */}
            <div className="card p-6">
              <h3 className="text-sm font-medium mb-3 text-foreground">💡 使用说明</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <strong>声调填充插件</strong>从 OJAD 查询日语单词的声调，
                    用带圈数字（⓪①②…）填充 accent 字段
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>默认只处理 accent 为空的词条，勾选"强制覆盖"可更新已有数据</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>启用缓存可避免重复请求 OJAD，提升处理速度</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>建议请求延迟设为 0.3 秒以上，避免对 OJAD 造成过大压力</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
