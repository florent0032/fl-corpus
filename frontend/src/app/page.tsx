"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LanguageSelector } from "@/components/LanguageSelector";

const API = "/api/proxy";

interface Collection {
  id: string;
  name: string;
  desc: string;
  lang: string;
  output_format: string;
  usage_field?: string;  // 用例字段名，默认 "usages"
  created_at: string;
  total: number;
  pending: number;
}

interface OutputFormat {
  id: string;
  name: string;
  description: string;
}

interface Language {
  code: string;
  name: string;
  name_en: string;
}

export default function Home() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [outputFormats, setOutputFormats] = useState<OutputFormat[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLang, setSelectedLang] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [message, setMessage] = useState("");
  const [showMoreSettings, setShowMoreSettings] = useState(false);

  // 添加词库表单
  const [newCollection, setNewCollection] = useState({
    lang: "ja",
    id: "",
    name: "",
    desc: "",
    output_format: "ja_entry",
    usage_field: "usages",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 加载输出格式
      const formatsRes = await fetch(`${API}/output-formats`);
      const formatsData = await formatsRes.json();
      setOutputFormats(formatsData.items || []);

      // 加载语言和词库
      const res = await fetch(`${API}/languages`);
      const data = await res.json();

      // 保存语言列表
      setLanguages(data.items || []);

      const allCollections: Collection[] = [];
      for (const lang of data.items || []) {
        for (const col of lang.collections || []) {
          allCollections.push({
            ...col,
            lang: lang.code,
            usage_field: col.usage_field || "usages",
            total: 0,
            pending: 0,
          });
        }
      }

      // 获取每个词语库的实际数量
      const countPromises = allCollections.map(async (col) => {
        try {
          const processedRes = await fetch(
            `${API}/words/processed?collection_id=${col.id}&size=1`
          );
          const processedData = await processedRes.json();

          const pendingRes = await fetch(
            `${API}/words?collection_id=${col.id}&status=pending&size=1`
          );
          const pendingData = await pendingRes.json();

          return {
            ...col,
            total: processedData.total || 0,
            pending: pendingData.total || 0,
          };
        } catch {
          return col;
        }
      });

      const collectionsWithCounts = await Promise.all(countPromises);
      setCollections(collectionsWithCounts);
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

  const getFormatName = (formatId: string) => {
    const format = outputFormats.find((f) => f.id === formatId);
    return format?.name || formatId;
  };

  const filteredCollections =
    selectedLang === "all"
      ? collections
      : collections.filter((c) => c.lang === selectedLang);

  const totalCollections = collections.length;
  const totalWords = collections.reduce((sum, c) => sum + c.total, 0);
  const totalPending = collections.reduce((sum, c) => sum + c.pending, 0);

  // 添加词库
  const handleAddCollection = async () => {
    if (!newCollection.id || !newCollection.name) {
      setMessage("❌ 请填写词库 ID 和名称");
      return;
    }

    try {
      const res = await fetch(`${API}/languages/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCollection),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 词库添加成功");
        setShowAddModal(false);
        setNewCollection({ lang: "ja", id: "", name: "", desc: "", output_format: "ja_entry" });
        loadData();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  // 更新词库
  const handleUpdateCollection = async () => {
    if (!editingCollection) return;

    try {
      const res = await fetch(
        `${API}/languages/collections/${editingCollection.lang}/${editingCollection.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingCollection.name,
            desc: editingCollection.desc,
            output_format: editingCollection.output_format,
          }),
        }
      );
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 词库更新成功");
        setEditingCollection(null);
        loadData();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  // 删除词库
  const handleDeleteCollection = async (lang: string, id: string) => {
    if (!confirm("确定删除这个词库吗？删除后不可恢复！")) return;

    try {
      const res = await fetch(`${API}/languages/collections/${lang}/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage("✅ 词库删除成功");
        loadData();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const resetForm = () => {
    setNewCollection({ lang: "ja", id: "", name: "", desc: "", output_format: "ja_entry" });
    setEditingCollection(null);
  };

  // 导出词库为 JSON 文件
  const handleExportCollection = async (lang: string, collectionId: string, collectionName: string) => {
    try {
      const res = await fetch(`${API}/words/processed?collection_id=${collectionId}&size=10000`);
      const data = await res.json();
      const entries = data.items || [];

      if (entries.length === 0) {
        setMessage("❌ 词库为空，无法导出");
        return;
      }

      // 创建 JSON 文件并下载
      const jsonStr = JSON.stringify(entries, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${collectionName}_${lang}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage(`✅ 已导出 ${entries.length} 个词条`);
    } catch (e) {
      setMessage("❌ 导出失败");
    }
  };

  // 查看文件目录
  const handleViewFile = (collectionId: string) => {
    const filePath = `data/output/${collectionId}.json`;
    setMessage(`📁 文件路径: ${filePath}`);

    // 尝试复制到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(filePath).then(() => {
        setMessage(`📁 文件路径已复制: ${filePath}`);
      }).catch(() => {
        // 复制失败，只显示路径
        setMessage(`📁 文件路径: ${filePath}`);
      });
    } else {
      // 不支持 clipboard API，只显示路径
      setMessage(`📁 文件路径: ${filePath}`);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">词语库</h1>
            <p className="mt-1 text-muted-foreground">管理多语种词语库，每个词库绑定一个输出格式</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="btn-gradient px-5 py-2.5 rounded-xl font-medium"
          >
            + 添加词库
          </button>
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

      {/* 统计概览 */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-2xl">
              📚
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{totalCollections}</div>
              <div className="text-sm text-muted-foreground">词库总数</div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-2xl">
              📝
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{totalWords.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">词条总数</div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center text-2xl">
              ⏳
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{totalPending}</div>
              <div className="text-sm text-muted-foreground">待处理</div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-2xl">
              🌍
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{new Set(collections.map((c) => c.lang)).size}</div>
              <div className="text-sm text-muted-foreground">支持语言</div>
            </div>
          </div>
        </div>
      </div>

      {/* 语言筛选 */}
      <div className="mb-6">
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          className="select w-48"
        >
          <option value="all">🌍 全部语言</option>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {getLangEmoji(lang.code)} {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* 词语库列表 */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary" />
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-xl text-muted-foreground">暂无词语库</p>
          <p className="mt-2 text-muted-foreground">点击"添加词库"按钮创建第一个词库</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCollections.map((col) => (
            <div
              key={`${col.lang}-${col.id}`}
              className="group card overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1"
            >
              {/* 顶部装饰条 */}
              <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />

              <div className="p-5">
                {/* 头部：语言标识和操作 */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-3xl shadow-lg">
                      {getLangEmoji(col.lang)}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-card-foreground group-hover:text-primary transition-colors">
                        {col.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{getLangName(col.lang)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setEditingCollection(col);
                      }}
                      className="p-2 rounded-lg hover:bg-accent transition-colors"
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteCollection(col.lang, col.id);
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* 描述 */}
                {col.desc && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {col.desc}
                  </p>
                )}

                {/* 输出格式标签 */}
                <div className="mb-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/50 text-xs font-medium text-foreground">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {getFormatName(col.output_format)}
                  </span>
                </div>

                {/* 统计数据 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-accent/30">
                    <div className="text-lg font-bold text-foreground">{col.total.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">词条数</div>
                  </div>
                  <div className="p-3 rounded-xl bg-accent/30">
                    <div className="text-lg font-bold text-yellow-500">{col.pending}</div>
                    <div className="text-xs text-muted-foreground">待处理</div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  <Link
                    href={`/words/${col.lang}/${col.id}`}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 text-primary font-medium hover:from-primary/20 hover:to-purple-500/20 transition-all"
                  >
                    <span>进入</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportCollection(col.lang, col.id, col.name);
                    }}
                    className="px-3 py-3 rounded-xl bg-accent text-accent-foreground hover:bg-secondary transition-colors cursor-pointer"
                    title="导出 JSON"
                  >
                    📥
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewFile(col.id);
                    }}
                    className="px-3 py-3 rounded-xl bg-accent text-accent-foreground hover:bg-secondary transition-colors cursor-pointer"
                    title="查看文件目录"
                  >
                    📁
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加词库模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-lg animate-scaleIn">
            <h2 className="text-xl font-bold mb-6 text-card-foreground">添加词库</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <LanguageSelector
                  value={newCollection.lang}
                  onChange={(code) => setNewCollection({ ...newCollection, lang: code })}
                  label="语种 *"
                  placeholder="选择语言..."
                />
                <div>
                  <label className="block text-sm mb-1.5 text-muted-foreground">词库 ID *</label>
                  <input
                    type="text"
                    value={newCollection.id}
                    onChange={(e) => setNewCollection({ ...newCollection, id: e.target.value })}
                    placeholder="如: n1, jlpt_n2, topik1"
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">词库名称 *</label>
                <input
                  type="text"
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  placeholder="如: JLPT N1, TOPIK II"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">描述</label>
                <input
                  type="text"
                  value={newCollection.desc}
                  onChange={(e) => setNewCollection({ ...newCollection, desc: e.target.value })}
                  placeholder="词库描述"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">输出格式 *</label>
                <select
                  value={newCollection.output_format}
                  onChange={(e) => setNewCollection({ ...newCollection, output_format: e.target.value })}
                  className="select w-full"
                >
                  {outputFormats.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  输出格式决定词条的结构和字段
                </p>
              </div>

              {/* 更多设置 */}
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowMoreSettings(!showMoreSettings)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                >
                  <span>更多设置</span>
                  <span className="text-muted-foreground">{showMoreSettings ? "▲" : "▼"}</span>
                </button>
                {showMoreSettings && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border">
                    <div>
                      <label className="block text-sm mb-1.5 text-muted-foreground">
                        用例字段名
                      </label>
                      <input
                        type="text"
                        value={newCollection.usage_field}
                        onChange={(e) => setNewCollection({ ...newCollection, usage_field: e.target.value })}
                        placeholder="如: usages, usage, examples"
                        className="input w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        词条 JSON 中用例数组的字段名，用于显示用例数
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleAddCollection}
                className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑词库模态框 */}
      {editingCollection && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-lg animate-scaleIn">
            <h2 className="text-xl font-bold mb-6 text-card-foreground">编辑词库</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 text-muted-foreground">语种</label>
                  <input
                    type="text"
                    value={getLangName(editingCollection.lang)}
                    disabled
                    className="input w-full opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1.5 text-muted-foreground">词库 ID</label>
                  <input
                    type="text"
                    value={editingCollection.id}
                    disabled
                    className="input w-full opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">词库名称 *</label>
                <input
                  type="text"
                  value={editingCollection.name}
                  onChange={(e) => setEditingCollection({ ...editingCollection, name: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">描述</label>
                <input
                  type="text"
                  value={editingCollection.desc}
                  onChange={(e) => setEditingCollection({ ...editingCollection, desc: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">输出格式 *</label>
                <select
                  value={editingCollection.output_format}
                  onChange={(e) => setEditingCollection({ ...editingCollection, output_format: e.target.value })}
                  className="select w-full"
                >
                  {outputFormats.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* 更多设置 */}
              <div className="border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowMoreSettings(!showMoreSettings)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
                >
                  <span>更多设置</span>
                  <span className="text-muted-foreground">{showMoreSettings ? "▲" : "▼"}</span>
                </button>
                {showMoreSettings && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border">
                    <div>
                      <label className="block text-sm mb-1.5 text-muted-foreground">
                        用例字段名
                      </label>
                      <input
                        type="text"
                        value={editingCollection.usage_field || "usages"}
                        onChange={(e) => setEditingCollection({ ...editingCollection, usage_field: e.target.value })}
                        placeholder="如: usages, usage, examples"
                        className="input w-full"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        词条 JSON 中用例数组的字段名，用于显示用例数
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setEditingCollection(null); resetForm(); }}
                className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleUpdateCollection}
                className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
