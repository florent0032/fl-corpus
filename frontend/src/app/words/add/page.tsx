"use client";

import { useState, useEffect } from "react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { getLanguageByCode } from "@/lib/languages";

const API = "/api/proxy";

interface Language {
  code: string;
  name: string;
  collections: { id: string; name: string; desc: string; output_format: string }[];
}

interface PendingWord {
  id: string;
  lang: string;
  collection_id: string;
  word: string;
  json_input: Record<string, any>;
  knowledge_bases: string[];
  fallback_words: string[];
  added_at: string;
  status: string;
}

interface OutputFormat {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
}

interface KB {
  name: string;
  description: string;
  lang: string;
  stats: { files: number; chunks: number };
  enabled: boolean;
}

interface FieldConfig {
  id: string;
  name: string;
  name_en: string;
  field_type: string;
  languages: string[];
  default_enabled: boolean;
  default_value: string;
  is_preset: boolean;
  placeholder: string;
  description: string;
}

export default function AddWordPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState("ja");
  const [selectedCollection, setSelectedCollection] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat | null>(null);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);

  // JSON 输入状态
  const [jsonInput, setJsonInput] = useState<Record<string, any>>({});
  const [jsonText, setJsonText] = useState("{}");
  const [jsonError, setJsonError] = useState("");

  // 知识库选择状态
  const [availableKBs, setAvailableKBs] = useState<KB[]>([]);
  const [selectedKBs, setSelectedKBs] = useState<string[]>([]);

  // 兜底词状态
  const [fallbackWords, setFallbackWords] = useState<string[]>([]);
  const [newFallback, setNewFallback] = useState("");

  const [pendingWords, setPendingWords] = useState<PendingWord[]>([]);
  const [editingWord, setEditingWord] = useState<PendingWord | null>(null);
  const [viewingWord, setViewingWord] = useState<PendingWord | null>(null);
  const [viewingWordEditing, setViewingWordEditing] = useState(false);
  const [viewingWordJson, setViewingWordJson] = useState("{}");
  const [viewingWordJsonError, setViewingWordJsonError] = useState("");

  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadLanguages();
    loadKBs();
    loadFieldConfigs();
    loadPendingWords();
  }, []);

  useEffect(() => {
    if (selectedLang && selectedCollection) {
      loadOutputFormat();
      loadPendingWords();
    }
  }, [selectedLang, selectedCollection]);

  const loadLanguages = async () => {
    try {
      const res = await fetch(`${API}/languages`);
      const data = await res.json();
      setLanguages(data.items || []);

      if (data.items?.length > 0) {
        const firstLang = data.items[0];
        setSelectedLang(firstLang.code);
        if (firstLang.collections?.length > 0) {
          setSelectedCollection(firstLang.collections[0].id);
        }
      }
    } catch (e) {
      console.error("加载语言失败:", e);
    }
  };

  const loadKBs = async () => {
    try {
      const res = await fetch(`${API}/kb`);
      const data = await res.json();
      const kbs = (data.items || []).filter((kb: KB) => kb.enabled);
      setAvailableKBs(kbs);
      setSelectedKBs(kbs.map((kb: KB) => kb.name));
    } catch (e) {
      console.error("加载知识库失败:", e);
    }
  };

  const loadFieldConfigs = async () => {
    try {
      const res = await fetch(`${API}/fields`);
      const data = await res.json();
      setFieldConfigs(data.items || []);
    } catch (e) {
      console.error("加载字段配置失败:", e);
    }
  };

  const loadOutputFormat = async () => {
    try {
      // 获取当前词库绑定的输出格式
      const langRes = await fetch(`${API}/languages/${selectedLang}`);
      const langData = await langRes.json();
      const collection = langData.data?.collections?.find(
        (c: any) => c.id === selectedCollection
      );

      if (collection?.output_format) {
        const formatsRes = await fetch(`${API}/output-formats`);
        const formatsData = await formatsRes.json();
        const format = (formatsData.items || []).find(
          (f: OutputFormat) => f.id === collection.output_format
        );
        if (format) {
          setOutputFormat(format);
          // 初始化 JSON 输入
          initializeJsonFromSchema(format.schema);
        }
      }
    } catch (e) {
      console.error("加载输出格式失败:", e);
    }
  };

  const initializeJsonFromSchema = (schema: Record<string, any>) => {
    const initial: Record<string, any> = {};
    const properties = schema?.properties || {};
    for (const [key, prop] of Object.entries(properties)) {
      const p = prop as any;
      if (p.type === "string") initial[key] = "";
      else if (p.type === "array") initial[key] = [];
      else if (p.type === "object") initial[key] = {};
      else if (p.type === "number") initial[key] = 0;
      else initial[key] = "";
    }
    setJsonInput(initial);
    setJsonText(JSON.stringify(initial, null, 2));
  };

  const loadPendingWords = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedLang) params.set("lang", selectedLang);
      if (selectedCollection) params.set("collection_id", selectedCollection);
      params.set("size", "5000");  // 加载所有待处理词语
      const res = await fetch(`${API}/words?${params}`);
      const data = await res.json();
      setPendingWords(data.items || []);
    } catch (e) {
      console.error("加载待处理词语失败:", e);
    }
  };

  const currentLang = languages.find((l) => l.code === selectedLang);
  const collections = currentLang?.collections || [];

  // 知识库选择操作
  const toggleKB = (kbName: string) => {
    setSelectedKBs((prev) =>
      prev.includes(kbName) ? prev.filter((n) => n !== kbName) : [...prev, kbName]
    );
  };

  const moveKBUp = (index: number) => {
    if (index <= 0) return;
    const newKBs = [...selectedKBs];
    [newKBs[index - 1], newKBs[index]] = [newKBs[index], newKBs[index - 1]];
    setSelectedKBs(newKBs);
  };

  const moveKBDown = (index: number) => {
    if (index >= selectedKBs.length - 1) return;
    const newKBs = [...selectedKBs];
    [newKBs[index], newKBs[index + 1]] = [newKBs[index + 1], newKBs[index]];
    setSelectedKBs(newKBs);
  };

  const resetForm = () => {
    if (outputFormat) {
      initializeJsonFromSchema(outputFormat.schema);
    } else {
      setJsonInput({});
      setJsonText("{}");
    }
    setFallbackWords([]);
    setNewFallback("");
    setEditingWord(null);
    setJsonError("");
  };

  const handleJsonTextChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonInput(parsed);
      setJsonError("");
    } catch (e: any) {
      setJsonError(`JSON 格式错误: ${e.message}`);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...jsonInput, [field]: value };
    setJsonInput(updated);
    setJsonText(JSON.stringify(updated, null, 2));
  };


  const handleSubmit = async () => {
    const word = jsonInput.word || jsonInput["单词"] || "";
    if (!word.trim()) {
      setMessage("❌ 请输入词语（word 字段）");
      return;
    }

    if (!selectedCollection) {
      setMessage("❌ 请选择词语库");
      return;
    }

    if (jsonError) {
      setMessage("❌ 请修正 JSON 格式错误");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const url = editingWord ? `${API}/words/${editingWord.id}` : `${API}/words`;
      const method = editingWord ? "PUT" : "POST";

      // word 和 json_input 保留原始音标，搜索时由后端去掉
      const body: any = {
        word: word.trim(),
        json_input: jsonInput,
        knowledge_bases: selectedKBs,
        fallback_words: fallbackWords,
      };

      if (!editingWord) {
        body.lang = selectedLang;
        body.collection_id = selectedCollection;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        resetForm();
        loadPendingWords();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (w: PendingWord) => {
    setEditingWord(w);
    setJsonInput(w.json_input || {});
    setJsonText(JSON.stringify(w.json_input || {}, null, 2));

    if (w.knowledge_bases && w.knowledge_bases.length > 0) {
      setSelectedKBs(w.knowledge_bases);
    }

    if (w.fallback_words && w.fallback_words.length > 0) {
      setFallbackWords(w.fallback_words);
    }
  };

  const handleDelete = async (wordId: string) => {
    if (!confirm("确定删除这个词语吗？")) return;

    try {
      const res = await fetch(`${API}/words/${wordId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("✅ 删除成功");
        loadPendingWords();
      } else {
        setMessage("❌ 删除失败");
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const saveViewingWordJson = async () => {
    if (!viewingWord || viewingWordJsonError) return;
    try {
      const parsed = JSON.parse(viewingWordJson);
      const res = await fetch(`${API}/words/${viewingWord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json_input: parsed }),
      });
      if (res.ok) {
        setMessage("✅ JSON 已更新");
        setViewingWordEditing(false);
        setViewingWord({ ...viewingWord, json_input: parsed });
        loadPendingWords();
      } else {
        const data = await res.json();
        setViewingWordJsonError(data.detail || data.message || "保存失败");
      }
    } catch (e) {
      setViewingWordJsonError("网络错误");
    }
  };

  // 渲染 JSON 字段编辑器
  const renderJsonFieldEditor = () => {
    if (!outputFormat) return null;

    const properties = outputFormat.schema?.properties || {};
    const required = outputFormat.schema?.required || [];

    return (
      <div className="space-y-4">
        {Object.entries(properties).map(([key, prop]) => {
          const p = prop as any;
          const isRequired = required.includes(key);
          const value = jsonInput[key];

          // 检查字段配置是否有默认值
          const fieldConfig = fieldConfigs.find((f) => f.id === key);
          const hasDefaultValue = fieldConfig?.default_value && fieldConfig.default_value.trim() !== "";
          // 如果有默认值，不需要标红星
          const showRequired = isRequired && !hasDefaultValue;

          return (
            <div key={key}>
              <label className="flex items-center gap-2 text-sm mb-1.5 text-muted-foreground">
                <span className="font-medium text-foreground">{key}</span>
                {showRequired && <span className="text-red-500">*</span>}
                <span className="text-xs">({p.type})</span>
                {p.description && (
                  <span className="text-xs text-muted-foreground/60">- {p.description}</span>
                )}
                {hasDefaultValue && (
                  <span className="text-xs text-green-500/60">默认: {fieldConfig.default_value}</span>
                )}
              </label>

              {p.type === "string" ? (
                <input
                  type="text"
                  value={value || ""}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  placeholder={p.description || `输入 ${key}`}
                  className="input w-full"
                />
              ) : p.type === "array" ? (
                <textarea
                  value={JSON.stringify(value || [], null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleFieldChange(key, parsed);
                    } catch {
                      // 允许不完整的 JSON
                    }
                  }}
                  placeholder={`输入 ${key} 数组 (JSON 格式)`}
                  className="input w-full font-mono text-sm"
                  rows={3}
                />
              ) : p.type === "object" ? (
                <textarea
                  value={JSON.stringify(value || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      handleFieldChange(key, parsed);
                    } catch {
                      // 允许不完整的 JSON
                    }
                  }}
                  placeholder={`输入 ${key} 对象 (JSON 格式)`}
                  className="input w-full font-mono text-sm"
                  rows={3}
                />
              ) : (
                <input
                  type="text"
                  value={JSON.stringify(value)}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  className="input w-full"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">添加词语</h1>
        <p className="mt-1 text-muted-foreground">
          添加新词语到待处理列表，选择知识库用于检索用例
        </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：添加表单 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基础信息 */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4 text-card-foreground">基础信息</h2>

            <div className="grid grid-cols-2 gap-4">
              <LanguageSelector
                value={selectedLang}
                onChange={(code) => {
                  setSelectedLang(code);
                  const lang = languages.find((l) => l.code === code);
                  if (lang?.collections?.length) {
                    setSelectedCollection(lang.collections[0].id);
                  }
                }}
                label="语种 *"
                placeholder="选择语言..."
              />

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">词语库 *</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="select w-full"
                >
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name} - {col.desc}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {outputFormat && (
              <div className="mt-3 p-3 rounded-lg bg-accent/30 border border-border">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">绑定格式:</span>
                  <span className="font-medium text-foreground">{outputFormat.name}</span>
                  <span className="text-xs text-muted-foreground/60">
                    ({outputFormat.description})
                  </span>
                </div>
              </div>
            )}

          </div>

          {/* JSON 字段编辑器 */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-card-foreground">
                词条信息
                {outputFormat && (
                  <span className="text-sm font-normal ml-2 text-muted-foreground">
                    (根据 {outputFormat.name} 格式)
                  </span>
                )}
              </h2>
              <button
                onClick={() => {
                  setJsonText(JSON.stringify(jsonInput, null, 2));
                }}
                className="text-xs text-primary hover:underline"
              >
                刷新 JSON
              </button>
            </div>

            {outputFormat ? (
              renderJsonFieldEditor()
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                请先选择词语库以加载输出格式
              </div>
            )}

            {/* 原始 JSON 编辑 */}
            <div className="mt-4">
              <label className="block text-sm mb-1.5 text-muted-foreground">
                原始 JSON (可直接编辑)
                {jsonError && <span className="text-red-500 ml-2">({jsonError})</span>}
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonTextChange(e.target.value)}
                className={`input w-full font-mono text-sm ${jsonError ? "border-red-500" : ""}`}
                rows={6}
              />
            </div>
          </div>

          {/* 知识库选择 */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">检索知识库</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  选择用于检索用例的知识库，拖拽调整优先级
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedKBs(availableKBs.map((kb) => kb.name))}
                  className="px-3 py-1.5 rounded-lg text-xs bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                >
                  全选
                </button>
                <button
                  onClick={() => setSelectedKBs([])}
                  className="px-3 py-1.5 rounded-lg text-xs bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                >
                  全不选
                </button>
              </div>
            </div>

            {availableKBs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                暂无可用知识库，请先在知识库管理页面创建
              </p>
            ) : (
              <div className="space-y-2">
                {selectedKBs.map((kbName, index) => {
                  const kb = availableKBs.find((k) => k.name === kbName);
                  if (!kb) return null;

                  return (
                    <div
                      key={kbName}
                      className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20"
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveKBUp(index)}
                          disabled={index === 0}
                          className="w-6 h-6 rounded flex items-center justify-center text-xs bg-accent hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveKBDown(index)}
                          disabled={index === selectedKBs.length - 1}
                          className="w-6 h-6 rounded flex items-center justify-center text-xs bg-accent hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          ↓
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">
                            #{index + 1}
                          </span>
                          <span className="font-medium text-card-foreground">{kb.name}</span>
                          {kb.description && (
                            <span className="text-xs text-muted-foreground truncate">
                              {kb.description}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(kb.stats?.chunks || 0).toLocaleString()} 语料块
                        </div>
                      </div>

                      <button
                        onClick={() => toggleKB(kbName)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}

                {availableKBs
                  .filter((kb) => !selectedKBs.includes(kb.name))
                  .map((kb) => (
                    <div
                      key={kb.name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-accent/30 border border-border/50 opacity-60"
                    >
                      <div className="w-[52px]" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-card-foreground">{kb.name}</span>
                          {kb.description && (
                            <span className="text-xs text-muted-foreground truncate">
                              {kb.description}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(kb.stats?.chunks || 0).toLocaleString()} 语料块
                        </div>
                      </div>

                      <button
                        onClick={() => toggleKB(kb.name)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        + 添加
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* 兜底词 */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-card-foreground">兜底词</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  当原词在语料库中检索不到足够用例时，使用兜底词继续搜索。
                  <span className="text-amber-500 font-medium">
                    兜底词是词的变位、变形（性数格的各种形态），不是近义词！
                  </span>
                </p>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newFallback}
                onChange={(e) => setNewFallback(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFallback.trim()) {
                    e.preventDefault();
                    if (!fallbackWords.includes(newFallback.trim())) {
                      setFallbackWords([...fallbackWords, newFallback.trim()]);
                    }
                    setNewFallback("");
                  }
                }}
                placeholder="输入兜底词（词的变位、变形），按回车添加"
                className="input flex-1"
              />
              <button
                onClick={() => {
                  if (newFallback.trim() && !fallbackWords.includes(newFallback.trim())) {
                    setFallbackWords([...fallbackWords, newFallback.trim()]);
                  }
                  setNewFallback("");
                }}
                className="btn-success px-4 py-2 rounded-xl text-sm font-medium"
              >
                + 添加
              </button>
            </div>

            {fallbackWords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fallbackWords.map((fw, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 text-sm"
                  >
                    {fw}
                    <button
                      onClick={() => setFallbackWords(fallbackWords.filter((_, i) => i !== index))}
                      className="hover:text-amber-400 ml-1"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-3 text-center">
                暂无兜底词，添加兜底词可以提高检索成功率
              </p>
            )}

            {fallbackWords.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-xs text-muted-foreground">
                  💡 提示：兜底词应该是原词的变位、变形形式。例如原词是阿拉伯语动词كَتَبَ，
                  兜底词可以是يَكْتُبُ（现在时）、اُكْتُبْ（命令式）、كَاتِب（主动名词）等。
                </p>
              </div>
            )}
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-4">
            {editingWord && (
              <button
                onClick={resetForm}
                className="px-6 py-3 rounded-xl bg-accent text-accent-foreground hover:bg-secondary transition-colors font-medium"
              >
                取消编辑
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedCollection}
              className="btn-gradient px-8 py-3 rounded-xl font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "提交中..." : editingWord ? "保存修改" : "添加到待处理"}
            </button>
          </div>
        </div>

        {/* 右侧：待处理词语列表 */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4 text-card-foreground">
            待处理词语
            <span className="badge badge-primary ml-2">{pendingWords.length}</span>
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {pendingWords.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">暂无待处理词语</p>
            ) : (
              pendingWords.map((w) => (
                <div
                  key={w.id}
                  className="p-4 rounded-xl bg-accent/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-card-foreground">{w.word}</div>
                      {(w.json_input?.meaning || w.json_input?.meaning_zh) && (
                        <div className="text-sm text-muted-foreground truncate">
                          {w.json_input.meaning || w.json_input.meaning_zh}
                        </div>
                      )}
                      {w.json_input?.pos && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {w.json_input.pos}
                        </span>
                      )}

                      {/* 知识库标签 */}
                      {w.knowledge_bases && w.knowledge_bases.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {w.knowledge_bases.map((kb) => (
                            <span
                              key={kb}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500"
                            >
                              {kb}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 兜底词标签 */}
                      {w.fallback_words && w.fallback_words.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className="text-[10px] text-muted-foreground">兜底:</span>
                          {w.fallback_words.map((fw, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500"
                            >
                              {fw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => setViewingWord(w)}
                        className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
                        title="查看详情"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleEdit(w)}
                        className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 查看/编辑详情模态框 */}
      {viewingWord && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-card-foreground">{viewingWord.word}</h2>
                <p className="text-sm text-muted-foreground">
                  {viewingWord.collection_id} · {viewingWord.status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {viewingWordEditing ? (
                  <>
                    <button
                      onClick={() => { setViewingWordEditing(false); setViewingWordJsonError(""); }}
                      className="px-3 py-1.5 rounded-lg text-xs bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveViewingWordJson}
                      disabled={!!viewingWordJsonError || isSaving}
                      className="px-3 py-1.5 rounded-lg text-xs bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
                    >
                      {isSaving ? "⏳ 保存中..." : "💾 保存"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setViewingWordEditing(true); setViewingWordJson(JSON.stringify(viewingWord.json_input, null, 2)); setViewingWordJsonError(""); }}
                    className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    ✏️ 编辑 JSON
                  </button>
                )}
                <button
                  onClick={() => { setViewingWord(null); setViewingWordEditing(false); }}
                  className="p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {viewingWordJsonError && (
              <div className="mb-3 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm border border-red-500/20">
                ⚠️ {viewingWordJsonError}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {viewingWordEditing ? (
                <textarea
                  value={viewingWordJson}
                  onChange={(e) => { setViewingWordJson(e.target.value); try { JSON.parse(e.target.value); setViewingWordJsonError(""); } catch (err: any) { setViewingWordJsonError(err.message); } }}
                  className={`w-full h-full min-h-[300px] p-4 rounded-xl font-mono text-sm resize-none input ${viewingWordJsonError ? "border-red-500" : ""}`}
                  spellCheck={false}
                />
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">json_input</label>
                    <pre className="p-4 rounded-xl bg-accent/30 border border-border overflow-auto text-sm font-mono text-card-foreground whitespace-pre-wrap">
                      {JSON.stringify(viewingWord.json_input, null, 2)}
                    </pre>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">知识库</label>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {viewingWord.knowledge_bases?.map((kb) => (
                          <span key={kb} className="badge badge-primary text-xs">{kb}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">兜底词</label>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {viewingWord.fallback_words?.length > 0 ? viewingWord.fallback_words.map((fw, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">{fw}</span>
                        )) : <span className="text-xs text-muted-foreground">无</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {viewingWordEditing && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{viewingWordJsonError ? "❌ JSON 格式无效" : "✅ JSON 格式有效"}</span>
                <span>{viewingWordJson.length} 字符</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
