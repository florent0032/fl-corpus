"use client";

import { useState, useEffect } from "react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { getLanguageByCode } from "@/lib/languages";

const API = "/api/proxy";

interface KB {
  name: string;
  description: string;
  lang: string;
  tags: string[];
  source_path: string;
  db_path: string;
  tokenizer: string;
  stats: { files: number; chunks: number };
  enabled: boolean;
}

interface DirEntry {
  name: string;
  path: string;
}

interface SearchResult {
  file: string;
  chunk: string;
  snippet: string;
  score: number;
  source: string;
  kb_name: string;
}

export default function KBPage() {
  const [kbs, setKBs] = useState<KB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterLang, setFilterLang] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");

  // 选中的知识库（右侧搜索目标）
  const [selectedKB, setSelectedKB] = useState<KB | null>(null);

  // 右侧搜索状态（独立于左侧过滤）
  const [contentQuery, setContentQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);

  // 创建知识库状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    lang: "ja",
    tags: "",
  });

  // 编辑知识库状态
  const [editingKB, setEditingKB] = useState<KB | null>(null);
  const [editForm, setEditForm] = useState({
    description: "",
    lang: "",
    tags: "",
  });

  // 目录浏览状态
  const [browsePath, setBrowsePath] = useState("/");
  const [browseDirs, setBrowseDirs] = useState<DirEntry[]>([]);
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");

  useEffect(() => {
    loadKBs();
  }, [filterLang]);

  // 当 KB 列表更新时，同步 selectedKB 的最新数据
  useEffect(() => {
    if (selectedKB) {
      const updated = kbs.find((kb) => kb.name === selectedKB.name);
      if (updated) setSelectedKB(updated);
    }
  }, [kbs]);

  const loadKBs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLang) params.set("lang", filterLang);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`${API}/kb?${params}`);
      const data = await res.json();
      setKBs(data.items || []);
    } catch (e) {
      console.error("加载失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getLangName = (code: string) => {
    const lang = getLanguageByCode(code);
    return lang ? lang.name : code;
  };

  // 目录浏览
  const browseDirectory = async (path: string) => {
    setIsBrowsing(true);
    try {
      const res = await fetch(`${API}/kb/browse/dirs?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setBrowsePath(data.path);
      setBrowseDirs(data.dirs || []);
    } catch (e: any) {
      setMessage(`❌ ${e.message || "目录浏览失败"}`);
    } finally {
      setIsBrowsing(false);
    }
  };

  const handleSelectDir = (path: string) => {
    setSelectedPath(path);
    browseDirectory(path);
  };

  const handleNavigateUp = () => {
    const parent = browsePath.split("/").slice(0, -1).join("/") || "/";
    browseDirectory(parent);
  };

  // 创建知识库
  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      setMessage("❌ 请输入知识库名称");
      return;
    }
    if (!selectedPath) {
      setMessage("❌ 请选择源文件目录");
      return;
    }

    try {
      const res = await fetch(`${API}/kb`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          source_path: selectedPath,
          description: createForm.description,
          lang: createForm.lang,
          tags: createForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setShowCreateModal(false);
        setCreateForm({ name: "", description: "", lang: "ja", tags: "" });
        setSelectedPath("");
        loadKBs();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  // 编辑知识库
  const handleEdit = (kb: KB) => {
    setEditingKB(kb);
    setEditForm({
      description: kb.description || "",
      lang: kb.lang || "ja",
      tags: (kb.tags || []).join(", "),
    });
  };

  const handleSaveEdit = async () => {
    if (!editingKB) return;

    try {
      const res = await fetch(`${API}/kb/${editingKB.name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editForm.description,
          lang: editForm.lang,
          tags: editForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ 知识库 ${editingKB.name} 已更新`);
        setEditingKB(null);
        loadKBs();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  // 删除知识库
  const handleDelete = async (kbName: string) => {
    if (!confirm(`确定删除知识库 "${kbName}" 吗？此操作不可恢复！`)) return;

    try {
      const res = await fetch(`${API}/kb/${kbName}`, { method: "DELETE" });
      if (res.ok) {
        setMessage(`✅ 知识库 ${kbName} 已删除`);
        if (selectedKB?.name === kbName) {
          setSelectedKB(null);
          setSearchResults([]);
          setContentQuery("");
        }
        loadKBs();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  // 切换启用/禁用
  const handleToggle = async (kbName: string) => {
    try {
      const res = await fetch(`${API}/kb/${kbName}/toggle`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        loadKBs();
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  // 搜索知识库内容
  const handleSearchKB = async () => {
    if (!selectedKB || !contentQuery.trim()) return;

    setIsSearching(true);
    setExpandedResult(null);
    try {
      const res = await fetch(
        `${API}/kb/${selectedKB.name}/search?q=${encodeURIComponent(contentQuery)}&size=20`
      );
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (e) {
      setMessage("❌ 搜索失败");
    } finally {
      setIsSearching(false);
    }
  };

  // 打开创建模态框
  const openCreateModal = () => {
    setShowCreateModal(true);
    browseDirectory("/");
    setSelectedPath("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部标题栏 */}
      <header className="shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">知识库管理</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              管理多语种语料知识库，用于检索用例
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-gradient px-4 py-2 rounded-xl text-sm font-medium"
          >
            + 创建知识库
          </button>
        </div>
      </header>

      {/* 消息提示 */}
      {message && (
        <div
          className={`mx-6 mb-3 p-3 rounded-xl text-sm animate-slideIn ${
            message.startsWith("✅")
              ? "bg-green-500/10 text-green-500 border border-green-500/20"
              : "bg-red-500/10 text-red-500 border border-red-500/20"
          }`}
        >
          {message}
        </div>
      )}

      {/* 左右分栏主体 */}
      <div className="flex-1 flex gap-4 px-6 pb-6 min-h-0">
        {/* ====== 左侧面板：KB 列表 ====== */}
        <div className="w-[380px] shrink-0 flex flex-col min-h-0">
          {/* 搜索/筛选 */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadKBs()}
              placeholder="搜索知识库..."
              className="input flex-1 text-sm"
            />
            <button onClick={loadKBs} className="btn-gradient px-3 py-1.5 rounded-lg text-sm">
              搜索
            </button>
          </div>
          <div className="mb-3">
            <LanguageSelector
              value={filterLang}
              onChange={(code) => setFilterLang(code)}
              placeholder="所有语种"
              showNative={false}
            />
          </div>

          {/* KB 列表 */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
              </div>
            ) : kbs.length === 0 ? (
              <div className="text-center py-12 card">
                <div className="text-3xl mb-3">📚</div>
                <p className="text-muted-foreground">暂无知识库</p>
                <p className="mt-1 text-sm text-muted-foreground">点击"创建知识库"开始</p>
              </div>
            ) : (
              kbs.map((kb) => (
                <div
                  key={kb.name}
                  onClick={() => {
                    setSelectedKB(kb);
                    setSearchResults([]);
                    setContentQuery("");
                    setExpandedResult(null);
                  }}
                  className={`card p-3.5 cursor-pointer transition-all animate-slideIn ${
                    selectedKB?.name === kb.name
                      ? "ring-2 ring-primary/50 border-primary/30"
                      : "hover:border-primary/20"
                  }`}
                >
                  {/* 卡片头部 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">📚</span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-card-foreground truncate">
                          {kb.name}
                        </h3>
                        {kb.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {kb.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {kb.lang && (
                        <span className="badge badge-primary text-[10px]">
                          {getLangName(kb.lang)}
                        </span>
                      )}
                      <span
                        className={`badge text-[10px] ${
                          kb.enabled ? "badge-success" : "badge-error"
                        }`}
                      >
                        {kb.enabled ? "已启用" : "已禁用"}
                      </span>
                    </div>
                  </div>

                  {/* 统计 */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                    <span>
                      文件 <span className="font-medium text-card-foreground">{kb.stats?.files || 0}</span>
                    </span>
                    <span>
                      语料块{" "}
                      <span className="font-medium text-card-foreground">
                        {(kb.stats?.chunks || 0).toLocaleString()}
                      </span>
                    </span>
                    {kb.tokenizer && (
                      <span>
                        分词器{" "}
                        <span className="font-mono text-card-foreground">{kb.tokenizer}</span>
                      </span>
                    )}
                  </div>

                  {/* 标签 */}
                  {kb.tags && kb.tags.length > 0 && (
                    <div className="flex gap-1 mb-2 flex-wrap">
                      {kb.tags.map((tag) => (
                        <span key={tag} className="badge badge-primary text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleEdit(kb)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                    >
                      编辑
                    </button>
                    <button
                      onClick={() => handleToggle(kb.name)}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        kb.enabled
                          ? "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/20"
                          : "bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20"
                      }`}
                    >
                      {kb.enabled ? "禁用" : "启用"}
                    </button>
                    <button
                      onClick={() => handleDelete(kb.name)}
                      className="px-2 py-1 rounded-md text-[11px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ====== 右侧面板：搜索 + 结果 ====== */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {!selectedKB ? (
            /* 未选中状态 */
            <div className="flex-1 flex items-center justify-center card">
              <div className="text-center">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-lg text-muted-foreground">选择一个知识库</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  从左侧列表中选择知识库以开始搜索
                </p>
              </div>
            </div>
          ) : (
            /* 已选中状态 */
            <>
              {/* KB 信息头部 */}
              <div className="card p-4 mb-3 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-lg">
                      📚
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-card-foreground">
                        {selectedKB.name}
                      </h2>
                      {selectedKB.description && (
                        <p className="text-sm text-muted-foreground">
                          {selectedKB.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedKB.lang && (
                      <span className="badge badge-primary text-xs">
                        {getLangName(selectedKB.lang)}
                      </span>
                    )}
                    <span
                      className={`badge text-xs ${
                        selectedKB.enabled ? "badge-success" : "badge-error"
                      }`}
                    >
                      {selectedKB.enabled ? "已启用" : "已禁用"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-5 text-xs text-muted-foreground">
                  <span>
                    文件数{" "}
                    <span className="font-medium text-card-foreground">
                      {selectedKB.stats?.files || 0}
                    </span>
                  </span>
                  <span>
                    语料块{" "}
                    <span className="font-medium text-card-foreground">
                      {(selectedKB.stats?.chunks || 0).toLocaleString()}
                    </span>
                  </span>
                  {selectedKB.tokenizer && (
                    <span>
                      分词器{" "}
                      <span className="font-mono text-card-foreground">
                        {selectedKB.tokenizer}
                      </span>
                    </span>
                  )}
                  {selectedKB.tags && selectedKB.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      标签{" "}
                      {selectedKB.tags.map((tag) => (
                        <span key={tag} className="badge badge-primary text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>

              {/* 搜索栏 */}
              <div className="card p-3 mb-3 shrink-0">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={contentQuery}
                    onChange={(e) => setContentQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchKB()}
                    placeholder={`在 ${selectedKB.name} 中搜索...`}
                    className="input flex-1 text-sm"
                  />
                  <button
                    onClick={handleSearchKB}
                    disabled={!contentQuery.trim() || isSearching}
                    className="btn-gradient px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {isSearching ? "搜索中..." : "搜索"}
                  </button>
                </div>
              </div>

              {/* 搜索结果 */}
              <div className="flex-1 card overflow-y-auto min-h-0">
                {searchResults.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    {isSearching ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-primary" />
                    ) : (
                      "输入关键词开始搜索"
                    )}
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    <div className="text-xs text-muted-foreground mb-2">
                      找到 {searchResults.length} 条结果
                    </div>
                    {searchResults.map((r, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/50 overflow-hidden animate-slideIn"
                      >
                        {/* 结果摘要行（可点击展开） */}
                        <button
                          onClick={() =>
                            setExpandedResult(expandedResult === i ? null : i)
                          }
                          className="w-full text-left p-3 hover:bg-accent/30 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="badge badge-primary text-[10px]">
                              分数 {r.score}
                            </span>
                            <span
                              className={`badge text-[10px] ${
                                r.source === "fts"
                                  ? "badge-success"
                                  : "badge-warning"
                              }`}
                            >
                              {r.source === "fts" ? "FTS匹配" : "LIKE匹配"}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate">
                              {r.file.split("/").pop()}
                            </span>
                          </div>
                          <p className="text-sm text-card-foreground line-clamp-2">
                            {r.snippet}
                          </p>
                        </button>

                        {/* 展开的详情面板 */}
                        {expandedResult === i && (
                          <div className="border-t border-border/50 bg-accent/10 p-4 animate-fadeIn">
                            <div className="grid grid-cols-[80px_1fr] gap-y-3 gap-x-4 text-sm">
                              <span className="text-muted-foreground font-medium">来源文件</span>
                              <span className="font-mono text-card-foreground break-all">
                                {r.file}
                              </span>

                              <span className="text-muted-foreground font-medium">块索引</span>
                              <span className="font-mono text-card-foreground">
                                Chunk #{r.chunk}
                              </span>

                              <span className="text-muted-foreground font-medium">匹配来源</span>
                              <span className="text-card-foreground">
                                {r.source === "fts" ? "FTS5 全文检索" : "SQL LIKE 模糊匹配"}
                              </span>

                              <span className="text-muted-foreground font-medium">评分</span>
                              <span className="text-card-foreground">{r.score}</span>

                              <span className="text-muted-foreground font-medium col-span-2 border-t border-border/30 pt-2" />

                              <span className="text-muted-foreground font-medium">完整内容</span>
                              <pre className="text-card-foreground whitespace-pre-wrap leading-relaxed bg-card/50 rounded-lg p-3 border border-border/30 max-h-64 overflow-y-auto">
{r.snippet}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ====== 创建知识库模态框 ====== */}
      {showCreateModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scaleIn">
            <h2 className="text-xl font-bold mb-6 text-card-foreground">创建知识库</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 text-muted-foreground">知识库名称 *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="如: anime, drama, novel"
                    className="input w-full"
                  />
                </div>
                <LanguageSelector
                  value={createForm.lang}
                  onChange={(code) => setCreateForm({ ...createForm, lang: code })}
                  label="语言"
                  placeholder="选择语言..."
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">描述</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="知识库描述"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={createForm.tags}
                  onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                  placeholder="动画, 字幕, 小说"
                  className="input w-full"
                />
              </div>

              {/* 目录浏览 */}
              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">
                  源文件目录 *
                  {selectedPath && (
                    <span className="ml-2 text-primary font-mono text-xs">{selectedPath}</span>
                  )}
                </label>

                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 p-3 bg-accent/50 border-b border-border">
                    <button
                      onClick={handleNavigateUp}
                      className="px-2 py-1 rounded-lg text-xs bg-secondary hover:bg-muted transition-colors"
                    >
                      ↑ 上级
                    </button>
                    <span className="text-sm font-mono text-muted-foreground flex-1 truncate">
                      {browsePath}
                    </span>
                    <button
                      onClick={() => browseDirectory(browsePath)}
                      className="px-2 py-1 rounded-lg text-xs bg-secondary hover:bg-muted transition-colors"
                    >
                      ↻
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    {isBrowsing ? (
                      <div className="flex justify-center items-center h-20">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-border border-t-primary" />
                      </div>
                    ) : browseDirs.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground">
                        此目录下没有子目录
                      </div>
                    ) : (
                      browseDirs.map((dir) => (
                        <button
                          key={dir.path}
                          onClick={() => handleSelectDir(dir.path)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                            selectedPath === dir.path ? "bg-primary/10 text-primary" : ""
                          }`}
                        >
                          <span>📁</span>
                          <span className="truncate">{dir.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedPath("");
                }}
                className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== 编辑知识库模态框 ====== */}
      {editingKB && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-lg animate-scaleIn">
            <h2 className="text-xl font-bold mb-6 text-card-foreground">
              编辑知识库: {editingKB.name}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">知识库名称</label>
                <input
                  type="text"
                  value={editingKB.name}
                  disabled
                  className="input w-full opacity-60 cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">名称不可修改</p>
              </div>

              <LanguageSelector
                value={editForm.lang}
                onChange={(code) => setEditForm({ ...editForm, lang: code })}
                label="语言"
                placeholder="选择语言..."
              />

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">描述</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="知识库描述"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="动画, 字幕, 小说"
                  className="input w-full"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingKB(null)}
                className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
