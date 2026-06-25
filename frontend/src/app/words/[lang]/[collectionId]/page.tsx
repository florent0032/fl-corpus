"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

const API = "/api/proxy";

interface ProcessedEntry {
  [key: string]: any;
}

interface OutputFormat {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
}

interface Collection {
  id: string;
  name: string;
  desc: string;
  output_format: string;
  created_at: string;
}

export default function CollectionPage({
  params,
}: {
  params: Promise<{ lang: string; collectionId: string }>;
}) {
  const { lang, collectionId } = use(params);

  const [entries, setEntries] = useState<ProcessedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");

  // 词库和输出格式信息
  const [collection, setCollection] = useState<Collection | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat | null>(null);

  // 查看/编辑状态
  const [viewingEntry, setViewingEntry] = useState<ProcessedEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editJson, setEditJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // 批量选择状态
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  useEffect(() => {
    loadData();
  }, [lang, collectionId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 加载词条数据
      const entriesRes = await fetch(
        `${API}/words/processed?collection_id=${collectionId}&size=5000`
      );
      const entriesData = await entriesRes.json();
      setEntries(entriesData.items || []);

      // 加载语言配置，获取当前词库信息
      const langRes = await fetch(`${API}/languages/${lang}`);
      const langData = await langRes.json();
      if (langData.data) {
        const col = langData.data.collections?.find(
          (c: any) => c.id === collectionId
        );
        if (col) {
          setCollection(col);

          // 加载绑定的输出格式
          if (col.output_format) {
            const formatsRes = await fetch(`${API}/output-formats`);
            const formatsData = await formatsRes.json();
            const format = (formatsData.items || []).find(
              (f: OutputFormat) => f.id === col.output_format
            );
            if (format) {
              setOutputFormat(format);
            }
          }
        }
      }
    } catch (e) {
      console.error("加载失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getLangName = (code: string) => {
    const names: Record<string, string> = {
      ja: "日语",
      ar: "阿拉伯语",
      ko: "韩语",
      fa: "波斯语",
      es: "西班牙语",
    };
    return names[code] || code;
  };

  const getLangEmoji = (code: string) => {
    const emojis: Record<string, string> = {
      ja: "🇯🇵",
      ar: "🇸🇦",
      ko: "🇰🇷",
      fa: "🇮🇷",
      es: "🇪🇸",
    };
    return emojis[code] || "🌍";
  };

  // 搜索过滤
  const filteredEntries = entries.filter((e) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const word = (e.word || "").toLowerCase();
      const pron = (e.pron || e.reading || "").toLowerCase();
      const meaning = (e.meaning_zh || e.meaning || "").toLowerCase();
      if (!word.includes(q) && !pron.includes(q) && !meaning.includes(q)) {
        return false;
      }
    }
    return true;
  });

  // 获取词条的主要显示字段
  const getDisplayFields = (entry: ProcessedEntry) => {
    // 根据词库配置的 usage_field 读取用例数
    const usageField = collection?.usage_field || "usages";
    const usages = entry[usageField];
    const usageCount = Array.isArray(usages) ? usages.length : 0;

    return {
      word: entry.word || "",
      pron: entry.pron || entry.reading || "",
      accent: entry.accent || "",
      pos: entry.pos || "",
      meaning: entry.meaning_zh || entry.meaning || "",
      usageCount,
    };
  };

  // 打开词条详情
  const openEntry = (entry: ProcessedEntry) => {
    if (isSelectMode) return;
    setViewingEntry(entry);
    setIsEditing(false);
    setEditJson(JSON.stringify(entry, null, 2));
    setJsonError("");
  };

  const startEdit = () => {
    setIsEditing(true);
    setEditJson(JSON.stringify(viewingEntry, null, 2));
    setJsonError("");
  };

  const validateJson = (jsonStr: string): string => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return "JSON 必须是一个对象";
      }
      if (!parsed.word) {
        return "缺少 word 字段";
      }
      return "";
    } catch (e: any) {
      return `JSON 语法错误: ${e.message}`;
    }
  };

  const handleJsonChange = (value: string) => {
    setEditJson(value);
    setJsonError(validateJson(value));
  };

  const saveEdit = async () => {
    const error = validateJson(editJson);
    if (error) {
      setJsonError(error);
      return;
    }

    const parsed = JSON.parse(editJson);
    const originalWord = viewingEntry?.word;

    setIsSaving(true);
    try {
      const res = await fetch(
        `${API}/words/processed/${collectionId}/${encodeURIComponent(originalWord!)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setJsonError(data.detail || data.message || "保存失败");
        return;
      }

      setViewingEntry(parsed);
      setIsEditing(false);
      setEntries((prev) =>
        prev.map((e) => (e.word === originalWord ? parsed : e))
      );
    } catch (e) {
      setJsonError("网络错误，请检查后端服务");
    } finally {
      setIsSaving(false);
    }
  };

  const copyJson = () => {
    navigator.clipboard.writeText(editJson);
  };

  // 批量选择操作
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      setSelectedWords(new Set());
    }
  };

  const toggleWordSelection = (word: string) => {
    setSelectedWords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(word)) {
        newSet.delete(word);
      } else {
        newSet.add(word);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedWords(new Set(filteredEntries.map((e) => e.word)));
  };

  const deselectAll = () => {
    setSelectedWords(new Set());
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedWords.size === 0) {
      setMessage("❌ 请选择要删除的词语");
      return;
    }

    if (!confirm(`确定删除选中的 ${selectedWords.size} 个词语吗？此操作不可恢复！`)) {
      return;
    }

    try {
      const res = await fetch(`${API}/words/processed/batch-delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: collectionId,
          words: Array.from(selectedWords),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setSelectedWords(new Set());
        setIsSelectMode(false);
        loadData();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  // 删除单个词语
  const handleDeleteSingle = async (word: string) => {
    if (!confirm(`确定删除词语 "${word}" 吗？`)) {
      return;
    }

    try {
      const res = await fetch(
        `${API}/words/processed/${collectionId}/${encodeURIComponent(word)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setMessage(`✅ 已删除: ${word}`);
        loadData();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* 面包屑导航 */}
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Link
            href="/"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            词语库
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground font-medium">
            {getLangEmoji(lang)} {collection?.name || collectionId.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <span className="text-4xl">{getLangEmoji(lang)}</span>
              {collection?.name || collectionId.toUpperCase()}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {getLangName(lang)} · {entries.length} 词条
              {collection?.desc && ` · ${collection.desc}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* 绑定的输出格式标签 */}
            {outputFormat && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent/50 border border-border">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-sm font-medium text-foreground">
                  {outputFormat.name}
                </span>
              </div>
            )}

            {/* 批量操作按钮 */}
            <button
              onClick={toggleSelectMode}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isSelectMode
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-accent-foreground hover:bg-secondary"
              }`}
            >
              {isSelectMode ? "取消选择" : "批量选择"}
            </button>
          </div>
        </div>
      </header>

      {message && (
        <div
          className={`mb-6 p-4 rounded-xl animate-slideIn ${
            message.startsWith("✅")
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}
        >
          {message}
        </div>
      )}

      {/* 搜索和批量操作栏 */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索词语、读音、释义..."
            className="input w-full pl-10"
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          显示 {filteredEntries.length} / {entries.length}
        </span>
      </div>

      {/* 批量操作工具栏 */}
      {isSelectMode && (
        <div className="mb-4 p-4 rounded-xl bg-accent/30 border border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground">
              已选择 <strong>{selectedWords.size}</strong> 个词语
            </span>
            <button
              onClick={selectAll}
              className="text-sm text-primary hover:underline"
            >
              全选
            </button>
            <button
              onClick={deselectAll}
              className="text-sm text-muted-foreground hover:underline"
            >
              取消全选
            </button>
          </div>
          <button
            onClick={handleBatchDelete}
            disabled={selectedWords.size === 0}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🗑️ 删除选中 ({selectedWords.size})
          </button>
        </div>
      )}

      {/* 词条列表 */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📖</div>
          <p className="text-xl text-muted-foreground">
            {searchQuery ? "没有匹配的词语" : "暂无词条"}
          </p>
          {!searchQuery && (
            <p className="mt-2 text-muted-foreground">
              前往"处理词语"页面添加待处理词语并生成词条
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry, i) => {
            const display = getDisplayFields(entry);
            const isSelected = selectedWords.has(entry.word);
            return (
              <div
                key={i}
                className={`group card p-5 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 ${
                  isSelectMode && isSelected
                    ? "ring-2 ring-primary bg-primary/5"
                    : ""
                }`}
                onClick={() => {
                  if (isSelectMode) {
                    toggleWordSelection(entry.word);
                  } else {
                    openEntry(entry);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isSelectMode && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleWordSelection(entry.word)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded accent-primary"
                        />
                      )}
                      <div className="text-xl font-bold text-card-foreground group-hover:text-primary transition-colors truncate">
                        {display.word}
                      </div>
                    </div>
                    {display.pron && (
                      <div className="text-sm text-muted-foreground mt-0.5 truncate">
                        {display.pron}
                        {display.accent && (
                          <span className="ml-2 text-primary font-medium">
                            {display.accent}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {display.pos && (
                      <span className="badge badge-primary ml-2 flex-shrink-0">
                        {display.pos}
                      </span>
                    )}
                    {!isSelectMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSingle(entry.word);
                        }}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                        title="删除"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-sm text-card-foreground mb-3 line-clamp-2">
                  {display.meaning}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {display.usageCount} 用例
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* JSON 查看/编辑模态框 */}
      {viewingEntry && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-card-foreground">
                  {viewingEntry.word}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {viewingEntry.pron || viewingEntry.reading}
                  {viewingEntry.accent && ` · ${viewingEntry.accent}`}
                  {viewingEntry.pos && ` · ${viewingEntry.pos}`}
                  {(viewingEntry.meaning_zh || viewingEntry.meaning) &&
                    ` · ${viewingEntry.meaning_zh || viewingEntry.meaning}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <>
                    <button
                      onClick={copyJson}
                      className="px-3 py-1.5 rounded-lg text-xs bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                    >
                      📋 复制
                    </button>
                    <button
                      onClick={startEdit}
                      className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      ✏️ 编辑
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setJsonError("");
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={!!jsonError || isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? "⏳ 保存中..." : "💾 保存"}
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setViewingEntry(null);
                    setIsEditing(false);
                  }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* JSON 错误提示 */}
            {isEditing && jsonError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm border border-red-500/20">
                ⚠️ {jsonError}
              </div>
            )}

            {/* JSON 内容 */}
            <div className="flex-1 overflow-auto">
              {isEditing ? (
                <textarea
                  value={editJson}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className={`w-full h-full min-h-[400px] p-4 rounded-xl font-mono text-sm resize-none input ${
                    jsonError ? "border-red-500" : ""
                  }`}
                  spellCheck={false}
                />
              ) : (
                <pre className="p-4 rounded-xl bg-accent/30 border border-border overflow-auto text-sm font-mono text-card-foreground whitespace-pre-wrap">
                  {JSON.stringify(viewingEntry, null, 2)}
                </pre>
              )}
            </div>

            {/* 底部状态栏 */}
            {isEditing && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {jsonError ? "❌ JSON 格式无效" : "✅ JSON 格式有效"}
                </span>
                <span>
                  {editJson.length} 字符
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
