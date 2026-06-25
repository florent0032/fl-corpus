"use client";

import { useState, useEffect } from "react";

const API = "/api/proxy";

interface Prompt {
  id: string;
  name: string;
  lang: string;
  task_type: string;
  description: string;
  template: string;
}

const LANGUAGES = [
  { code: "ja", name: "日语" },
  { code: "ar", name: "阿拉伯语" },
  { code: "ko", name: "韩语" },
  { code: "fa", name: "波斯语" },
  { code: "es", name: "西班牙语" },
];

const TASK_TYPES = [
  { value: "basic", label: "基础" },
  { value: "detailed", label: "详细" },
  { value: "academic", label: "学术" },
  { value: "verb", label: "动词" },
  { value: "custom", label: "自定义" },
];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterLang, setFilterLang] = useState("");
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    id: "",
    name: "",
    lang: "ja",
    task_type: "basic",
    description: "",
    template: "",
  });

  useEffect(() => {
    loadPrompts();
  }, [filterLang]);

  const loadPrompts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLang) params.set("lang", filterLang);

      const res = await fetch(`${API}/prompts?${params}`);
      const data = await res.json();
      setPrompts(data.items || []);
    } catch (e) {
      console.error("加载失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getLangName = (code: string) => {
    return LANGUAGES.find((l) => l.code === code)?.name || code;
  };

  const getTaskTypeName = (type: string) => {
    return TASK_TYPES.find((t) => t.value === type)?.label || type;
  };

  const resetForm = () => {
    setForm({
      id: "",
      name: "",
      lang: "ja",
      task_type: "basic",
      description: "",
      template: "",
    });
  };

  const handleAdd = async () => {
    if (!form.id || !form.name || !form.template) {
      setMessage("❌ 请填写必填字段（ID、名称、模板）");
      return;
    }

    try {
      const res = await fetch(`${API}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 提示词添加成功");
        setShowAddModal(false);
        resetForm();
        loadPrompts();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleEdit = async () => {
    if (!editingPrompt) return;

    try {
      const res = await fetch(`${API}/prompts/${editingPrompt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          lang: form.lang,
          task_type: form.task_type,
          description: form.description,
          template: form.template,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 提示词更新成功");
        setEditingPrompt(null);
        resetForm();
        loadPrompts();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleDelete = async (promptId: string) => {
    if (!confirm("确定删除这个提示词吗？")) return;

    try {
      const res = await fetch(`${API}/prompts/${promptId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("✅ 提示词删除成功");
        loadPrompts();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const openEditModal = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setForm({
      id: prompt.id,
      name: prompt.name,
      lang: prompt.lang,
      task_type: prompt.task_type,
      description: prompt.description,
      template: prompt.template,
    });
  };

  const renderFormModal = (isNew: boolean) => (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
      <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scaleIn">
        <h2 className="text-xl font-bold mb-6 text-card-foreground">
          {isNew ? "添加提示词" : "编辑提示词"}
        </h2>

        <div className="space-y-4">
          {isNew && (
            <div>
              <label className="block text-sm mb-1.5 text-muted-foreground">提示词 ID *</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="如: ja_basic, ko_detailed"
                className="input w-full"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5 text-muted-foreground">名称 *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="提示词名称"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-muted-foreground">语言</label>
              <select
                value={form.lang}
                onChange={(e) => setForm({ ...form, lang: e.target.value })}
                className="select w-full"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1.5 text-muted-foreground">任务类型</label>
              <select
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value })}
                className="select w-full"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1.5 text-muted-foreground">描述</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="简短描述"
                className="input w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground">提示词模板 *</label>
            <textarea
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
              placeholder="输入系统提示词模板..."
              className="input w-full font-mono text-sm"
              rows={12}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => {
              setShowAddModal(false);
              setEditingPrompt(null);
              resetForm();
            }}
            className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={isNew ? handleAdd : handleEdit}
            className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-medium"
          >
            {isNew ? "添加" : "保存修改"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">提示词管理</h1>
            <p className="mt-1 text-muted-foreground">管理系统提示词模板，用于处理词语时的 LLM 调用</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="btn-gradient px-5 py-2.5 rounded-xl font-medium"
          >
            + 添加提示词
          </button>
        </div>
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

      <div className="mb-6">
        <select
          value={filterLang}
          onChange={(e) => setFilterLang(e.target.value)}
          className="select"
        >
          <option value="">所有语种</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary" />
        </div>
      ) : prompts.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-xl text-muted-foreground">暂无提示词</p>
          <p className="mt-2 text-muted-foreground">点击"添加提示词"按钮创建</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="card p-5 animate-slideIn"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-card-foreground">{prompt.name}</h3>
                    <span className="badge badge-primary">{getLangName(prompt.lang)}</span>
                    <span className="badge" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.2)" }}>
                      {getTaskTypeName(prompt.task_type)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{prompt.description}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 font-mono">{prompt.id}</p>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => setViewingPrompt(prompt)}
                    className="icon-btn"
                    title="查看模板"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => openEditModal(prompt)}
                    className="icon-btn"
                    title="编辑"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(prompt.id)}
                    className="icon-btn hover:!bg-red-500/10 hover:!text-red-500"
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 查看模板模态框 */}
      {viewingPrompt && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-card-foreground">{viewingPrompt.name}</h2>
                <div className="flex gap-2 mt-2">
                  <span className="badge badge-primary">{getLangName(viewingPrompt.lang)}</span>
                  <span className="badge" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7", border: "1px solid rgba(168, 85, 247, 0.2)" }}>
                    {getTaskTypeName(viewingPrompt.task_type)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewingPrompt(null)}
                className="icon-btn"
              >
                ✕
              </button>
            </div>

            <p className="mb-4 text-muted-foreground">{viewingPrompt.description}</p>

            <div className="card p-4 bg-accent/30">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">提示词模板</h3>
              <pre className="whitespace-pre-wrap text-sm font-mono p-4 rounded-xl overflow-x-auto bg-card border border-border text-card-foreground">
                {viewingPrompt.template}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* 添加/编辑模态框 */}
      {showAddModal && renderFormModal(true)}
      {editingPrompt && renderFormModal(false)}
    </div>
  );
}
