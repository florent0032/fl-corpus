"use client";

import { useState, useEffect } from "react";

const API = "/api/proxy";

interface Vendor {
  id: string;
  name: string;
  models: string[];
}

interface ProcessStatus {
  running: boolean;
  total: number;
  processed: number;
  success: number;
  failed: number;
  current_word: string;
  errors: string[];
  started_at: string | null;
}

interface PendingWord {
  id: string;
  lang: string;
  collection_id: string;
  word: string;
  json_input: Record<string, any>;
  knowledge_bases: string[];
  fallback_words: string[];
  status: string;
  added_at: string;
}

interface Language {
  code: string;
  name: string;
  collections: { id: string; name: string; desc: string }[];
}

interface OutputFormat {
  id: string;
  name: string;
  description: string;
  json_schema: Record<string, any>;
  sample_output: string;
  retry_prompt: string;
}

interface Prompt {
  id: string;
  name: string;
  lang: string;
  task_type: string;
  description: string;
  template: string;
}

export default function ProcessPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState("");
  const [selectedCollection, setSelectedCollection] = useState("");

  // 提示词和输出格式
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [outputFormats, setOutputFormats] = useState<OutputFormat[]>([]);
  const [selectedFormat, setSelectedFormat] = useState("");

  const [maxUsages, setMaxUsages] = useState(25);
  const [minSnippetLen, setMinSnippetLen] = useState(15);
  const [batchSize, setBatchSize] = useState(0); // 0 = 全部

  const [status, setStatus] = useState<ProcessStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [pendingWords, setPendingWords] = useState<PendingWord[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(false);

  // 多选状态
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadVendors();
    loadLanguages();
    loadPrompts();
    loadOutputFormats();
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      loadModels(selectedVendor);
    }
  }, [selectedVendor]);

  useEffect(() => {
    loadPendingWords();
  }, [selectedLang, selectedCollection]);

  useEffect(() => {
    // 筛选当前语言的提示词
    if (selectedLang) {
      const filtered = prompts.filter((p) => p.lang === selectedLang);
      if (filtered.length > 0 && !selectedPrompt) {
        setSelectedPrompt(filtered[0].id);
      }
    }
  }, [selectedLang, prompts]);

  // 选择词库后自动填充输出格式
  useEffect(() => {
    if (!selectedCollection || !selectedLang) return;
    const lang = languages.find((l) => l.code === selectedLang);
    const col = lang?.collections?.find((c) => c.id === selectedCollection);
    if (col?.output_format) {
      setSelectedFormat(col.output_format);
    }
  }, [selectedCollection, selectedLang, languages]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isProcessing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API}/process/status`);
          const data = await res.json();
          setStatus(data);

          if (!data.running) {
            setIsProcessing(false);
            loadPendingWords();
          }
        } catch (e) {
          console.error("获取状态失败:", e);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing]);

  const loadVendors = async () => {
    try {
      const res = await fetch(`${API}/vendors`);
      const data = await res.json();
      setVendors(data.items || []);

      if (data.items?.length > 0) {
        setSelectedVendor(data.items[0].id);
      }
    } catch (e) {
      console.error("加载供应商失败:", e);
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

  const loadModels = async (vendorId: string) => {
    try {
      const res = await fetch(`${API}/vendors/${vendorId}/models`);
      const data = await res.json();
      setAvailableModels(data.models || []);

      if (data.models?.length > 0) {
        setSelectedModel(data.models[0]);
      }
    } catch (e) {
      console.error("加载模型失败:", e);
    }
  };

  const loadPrompts = async () => {
    try {
      const res = await fetch(`${API}/prompts`);
      const data = await res.json();
      setPrompts(data.items || []);
    } catch (e) {
      console.error("加载提示词失败:", e);
    }
  };

  const loadOutputFormats = async () => {
    try {
      const res = await fetch(`${API}/output-formats`);
      const data = await res.json();
      setOutputFormats(data.items || []);

      if (data.items?.length > 0) {
        setSelectedFormat(data.items[0].id);
      }
    } catch (e) {
      console.error("加载输出格式失败:", e);
    }
  };

  const loadPendingWords = async () => {
    setIsLoadingWords(true);
    try {
      const params = new URLSearchParams();
      if (selectedLang) params.set("lang", selectedLang);
      if (selectedCollection) params.set("collection_id", selectedCollection);
      params.set("status", "pending");
      params.set("size", "5000");  // 加载所有待处理词语

      const res = await fetch(`${API}/words?${params}`);
      const data = await res.json();
      const words = data.items || [];
      setPendingWords(words);

      // 默认全选
      setSelectedWordIds(new Set(words.map((w: PendingWord) => w.id)));
    } catch (e) {
      console.error("加载待处理词语失败:", e);
    } finally {
      setIsLoadingWords(false);
    }
  };

  // 选择操作
  const toggleWordSelection = (wordId: string) => {
    setSelectedWordIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(wordId)) {
        newSet.delete(wordId);
      } else {
        newSet.add(wordId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedWordIds(new Set(filteredWords.map((w) => w.id)));
  };

  const deselectAll = () => {
    setSelectedWordIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedWordIds.size === filteredWords.length) {
      deselectAll();
    } else {
      selectAll();
    }
  };

  // 筛选后的词语
  const filteredWords = searchQuery
    ? pendingWords.filter(
        (w) =>
          w.word.includes(searchQuery) ||
          (w.json_input?.pron || "").includes(searchQuery) ||
          (w.json_input?.meaning || w.json_input?.meaning_zh || "").includes(searchQuery)
      )
    : pendingWords;

  const selectedCount = selectedWordIds.size;

  const handleDeleteWord = async (wordId: string) => {
    if (!confirm("确定删除这个词语吗？")) return;

    try {
      const res = await fetch(`${API}/words/${wordId}`, { method: "DELETE" });
      if (res.ok) {
        setSelectedWordIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(wordId);
          return newSet;
        });
        loadPendingWords();
      }
    } catch (e) {
      console.error("删除失败:", e);
    }
  };

  const handleStartProcess = async () => {
    if (!selectedVendor || !selectedModel) {
      alert("请选择供应商和模型");
      return;
    }

    if (selectedCount === 0) {
      alert("请至少选择一个词语");
      return;
    }

    setIsProcessing(true);

    // 根据批次大小限制词语数量
    let wordIds = Array.from(selectedWordIds);
    if (batchSize > 0 && wordIds.length > batchSize) {
      wordIds = wordIds.slice(0, batchSize);
    }

    try {
      const res = await fetch(`${API}/process/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: selectedVendor,
          model: selectedModel,
          lang: selectedLang,
          system_prompt_id: selectedPrompt,
          output_format_id: selectedFormat,
          knowledge_bases: [],
          max_usages: maxUsages,
          min_snippet_len: minSnippetLen,
          word_ids: wordIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "启动失败");
        setIsProcessing(false);
      }
    } catch (e) {
      alert("网络错误");
      setIsProcessing(false);
    }
  };

  const handleStopProcess = async () => {
    try {
      await fetch(`${API}/process/stop`, { method: "POST" });
    } catch (e) {
      console.error("停止失败:", e);
    }
  };

  const currentLang = languages.find((l) => l.code === selectedLang);
  const collections = currentLang?.collections || [];

  // 筛选当前语言的提示词
  const filteredPrompts = selectedLang
    ? prompts.filter((p) => p.lang === selectedLang)
    : prompts;

  const progress = status
    ? status.total > 0
      ? (status.processed / status.total) * 100
      : 0
    : 0;

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">处理词语</h1>
        <p className="mt-1 text-muted-foreground">将待处理词语转换为完整的词条 JSON</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：配置面板 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 语言和词语库选择 */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-card-foreground">语言配置</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">语种</label>
                <select
                  value={selectedLang}
                  onChange={(e) => {
                    setSelectedLang(e.target.value);
                    setSelectedCollection("");
                  }}
                  className="select w-full"
                >
                  <option value="">所有语种</option>
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>

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
            </div>
          </div>

          {/* 供应商和模型选择 */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-card-foreground">LLM 配置</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">供应商</label>
                <select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="select w-full"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">模型</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="select w-full"
                >
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 提示词和输出格式 */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-card-foreground">提示词与输出格式</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">系统提示词</label>
                <select
                  value={selectedPrompt}
                  onChange={(e) => setSelectedPrompt(e.target.value)}
                  className="select w-full"
                >
                  <option value="">选择提示词</option>
                  {filteredPrompts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {selectedPrompt && (
                  <button
                    onClick={() => {
                      const p = prompts.find((pp) => pp.id === selectedPrompt);
                      if (p) alert(p.template);
                    }}
                    className="text-xs text-primary mt-1 hover:underline"
                  >
                    查看模板
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">输出格式</label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="select w-full"
                >
                  <option value="">选择输出格式</option>
                  {outputFormats.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                {selectedFormat && (() => {
                  const fmt = outputFormats.find((f) => f.id === selectedFormat);
                  return fmt?.description ? (
                    <p className="text-xs text-muted-foreground mt-1">{fmt.description}</p>
                  ) : null;
                })()}
              </div>
            </div>
          </div>

          {/* 处理配置 */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-card-foreground">处理配置</h2>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">最大用例数</label>
                <input
                  type="number"
                  value={maxUsages}
                  onChange={(e) => setMaxUsages(parseInt(e.target.value) || 25)}
                  min={0}
                  max={50}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">最短片段长度</label>
                <input
                  type="number"
                  value={minSnippetLen}
                  onChange={(e) => setMinSnippetLen(parseInt(e.target.value) || 15)}
                  min={5}
                  max={100}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">
                  批次大小
                  <span className="text-xs text-muted-foreground/60 ml-1">（0=全部）</span>
                </label>
                <input
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 0)}
                  min={0}
                  max={1000}
                  placeholder="0 = 全部处理"
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-4">
            {!isProcessing ? (
              <button
                onClick={handleStartProcess}
                disabled={!selectedVendor || !selectedModel || selectedCount === 0}
                className="btn-gradient flex-1 px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🚀 创建任务 ({batchSize > 0 ? Math.min(selectedCount, batchSize) : selectedCount} 个词语)
              </button>
            ) : (
              <>
                <button
                  onClick={handleStopProcess}
                  className="flex-1 px-6 py-3 rounded-xl font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
                >
                  ⏹️ 停止处理
                </button>
                <a
                  href="/tasks"
                  className="px-6 py-3 rounded-xl font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
                >
                  📊 任务管理
                </a>
              </>
            )}
          </div>

          {/* 处理进度 */}
          {status && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold mb-4 text-card-foreground">处理进度</h2>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">总体进度</span>
                    <span className="text-foreground">{status.processed} / {status.total}</span>
                  </div>
                  <div className="progress-bar h-4">
                    <div className="progress-fill h-full" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-right text-sm mt-1 text-muted-foreground">{progress.toFixed(1)}%</div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="card p-4 text-center bg-green-500/5 border-green-500/20">
                    <div className="text-2xl font-bold text-green-500">{status.success}</div>
                    <div className="text-sm text-muted-foreground">成功</div>
                  </div>
                  <div className="card p-4 text-center bg-red-500/5 border-red-500/20">
                    <div className="text-2xl font-bold text-red-500">{status.failed}</div>
                    <div className="text-sm text-muted-foreground">失败</div>
                  </div>
                  <div className="card p-4 text-center bg-yellow-500/5 border-yellow-500/20">
                    <div className="text-2xl font-bold text-yellow-500">{Math.max(0, status.total - status.success - status.failed)}</div>
                    <div className="text-sm text-muted-foreground">待处理</div>
                  </div>
                </div>

                {status.running && status.current_word && (
                  <div className="card p-4 border-l-4 border-primary">
                    <div className="text-sm text-muted-foreground">正在处理</div>
                    <div className="text-lg font-medium text-card-foreground">{status.current_word}</div>
                  </div>
                )}

                {status.errors.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 text-muted-foreground">最近错误</h3>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {status.errors.slice(-5).map((error, i) => (
                        <div key={i} className="card p-3 text-sm border-l-4 border-red-500 text-red-500">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右侧：待处理词语列表 */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-card-foreground">
              待处理词语
              <span className="badge badge-primary ml-2">{pendingWords.length}</span>
            </h2>
          </div>

          {/* 搜索和选择控制 */}
          <div className="space-y-3 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索词语..."
              className="input w-full text-sm"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className="px-3 py-1.5 rounded-lg text-xs bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                >
                  {selectedWordIds.size === filteredWords.length ? "取消全选" : "全选"}
                </button>
                <span className="text-xs text-muted-foreground">
                  已选 {selectedCount} / {filteredWords.length}
                </span>
              </div>

              {selectedCount > 0 && (
                <button
                  onClick={deselectAll}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  清空选择
                </button>
              )}
            </div>
          </div>

          {/* 词语列表 */}
          {isLoadingWords ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
            </div>
          ) : filteredWords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">暂无待处理词语</p>
              <p className="text-sm mt-2 text-muted-foreground">请先在"添加词语"页面添加词语</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredWords.map((w) => (
                <div
                  key={w.id}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedWordIds.has(w.id)
                      ? "bg-primary/5 border-primary/30"
                      : "bg-accent/50 border-border/50 hover:border-primary/20"
                  }`}
                  onClick={() => toggleWordSelection(w.id)}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedWordIds.has(w.id)}
                      onChange={() => toggleWordSelection(w.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded accent-primary flex-shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-card-foreground">{w.word}</div>
                      {(w.json_input?.meaning || w.json_input?.meaning_zh) && (
                        <div className="text-sm truncate text-muted-foreground">{w.json_input.meaning || w.json_input.meaning_zh}</div>
                      )}
                      {w.json_input?.pos && (
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {w.json_input.pos}
                        </span>
                      )}
                      {w.json_input?.pron && (
                        <span className="inline-block mt-1 ml-1 text-[10px] text-muted-foreground">
                          {w.json_input.pron}
                        </span>
                      )}
                      {w.knowledge_bases && w.knowledge_bases.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {w.knowledge_bases.map((kb) => (
                            <span key={kb} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                              {kb}
                            </span>
                          ))}
                        </div>
                      )}
                      {w.fallback_words && w.fallback_words.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">兜底:</span>
                          {w.fallback_words.map((fw, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">
                              {fw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWord(w.id);
                      }}
                      className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors flex-shrink-0"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
