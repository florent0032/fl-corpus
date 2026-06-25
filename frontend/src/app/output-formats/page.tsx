"use client";

import { useState, useEffect } from "react";

const API = "/api/proxy";

interface OutputFormat {
  id: string;
  name: string;
  description: string;
  schema: Record<string, any>;
  sample_output: string;
  retry_prompt: string;
  created_at: string;
  updated_at: string;
}

export default function OutputFormatsPage() {
  const [formats, setFormats] = useState<OutputFormat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingFormat, setEditingFormat] = useState<OutputFormat | null>(null);
  const [viewingFormat, setViewingFormat] = useState<OutputFormat | null>(null);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    schema: "{\n  \"type\": \"object\",\n  \"properties\": {},\n  \"required\": []\n}",
    sample_output: "",
    retry_prompt: "",
  });

  const [schemaError, setSchemaError] = useState("");

  useEffect(() => {
    loadFormats();
  }, []);

  const loadFormats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/output-formats`);
      const data = await res.json();
      setFormats(data.items || []);
    } catch (e) {
      console.error("加载失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      id: "",
      name: "",
      description: "",
      schema: "{\n  \"type\": \"object\",\n  \"properties\": {},\n  \"required\": []\n}",
      sample_output: "",
      retry_prompt: "",
    });
    setSchemaError("");
  };

  const validateSchema = (schemaStr: string): boolean => {
    try {
      JSON.parse(schemaStr);
      setSchemaError("");
      return true;
    } catch (e: any) {
      setSchemaError(`JSON 格式错误: ${e.message}`);
      return false;
    }
  };

  const handleAdd = async () => {
    if (!form.id || !form.name) {
      setMessage("❌ 请填写 ID 和名称");
      return;
    }

    if (!validateSchema(form.schema)) return;

    try {
      const res = await fetch(`${API}/output-formats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          schema: JSON.parse(form.schema),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 输出格式添加成功");
        setShowAddModal(false);
        resetForm();
        loadFormats();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleEdit = async () => {
    if (!editingFormat) return;

    if (!validateSchema(form.schema)) return;

    try {
      const res = await fetch(`${API}/output-formats/${editingFormat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          schema: JSON.parse(form.schema),
          sample_output: form.sample_output,
          retry_prompt: form.retry_prompt,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 输出格式更新成功");
        setEditingFormat(null);
        resetForm();
        loadFormats();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleDelete = async (formatId: string) => {
    if (!confirm("确定删除这个输出格式吗？")) return;

    try {
      const res = await fetch(`${API}/output-formats/${formatId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("✅ 输出格式删除成功");
        loadFormats();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const openEditModal = (format: OutputFormat) => {
    setEditingFormat(format);
    setForm({
      id: format.id,
      name: format.name,
      description: format.description,
      schema: JSON.stringify(format.schema, null, 2),
      sample_output: format.sample_output,
      retry_prompt: format.retry_prompt,
    });
    setSchemaError("");
  };

  const renderFormModal = (isNew: boolean) => (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
      <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scaleIn">
        <h2 className="text-xl font-bold mb-6 text-card-foreground">
          {isNew ? "添加输出格式" : "编辑输出格式"}
        </h2>

        <div className="space-y-4">
          {isNew && (
            <div>
              <label className="block text-sm mb-1.5 text-muted-foreground">格式 ID *</label>
              <input
                type="text"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder="如: entry_json, usage_array"
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
                placeholder="格式名称"
                className="input w-full"
              />
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
            <label className="block text-sm mb-1.5 text-muted-foreground">
              JSON Schema *
              {schemaError && <span className="text-red-500 ml-2">({schemaError})</span>}
            </label>
            <textarea
              value={form.schema}
              onChange={(e) => {
                setForm({ ...form, schema: e.target.value });
                validateSchema(e.target.value);
              }}
              placeholder='{"type": "object", "properties": {...}}'
              className={`input w-full font-mono text-sm ${schemaError ? "border-red-500" : ""}`}
              rows={8}
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground">示例输出</label>
            <textarea
              value={form.sample_output}
              onChange={(e) => setForm({ ...form, sample_output: e.target.value })}
              placeholder="LLM 输出的 JSON 示例..."
              className="input w-full font-mono text-sm"
              rows={5}
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground">重试提示词</label>
            <textarea
              value={form.retry_prompt}
              onChange={(e) => setForm({ ...form, retry_prompt: e.target.value })}
              placeholder="当输出格式不符时，发送给 LLM 的重试提示..."
              className="input w-full text-sm"
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => {
              setShowAddModal(false);
              setEditingFormat(null);
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
            <h1 className="text-3xl font-bold text-foreground">输出格式管理</h1>
            <p className="mt-1 text-muted-foreground">管理 LLM 输出的 JSON 格式定义，用于验证和重试</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="btn-gradient px-5 py-2.5 rounded-xl font-medium"
          >
            + 添加输出格式
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

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-border border-t-primary" />
        </div>
      ) : formats.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-4xl mb-4">📐</div>
          <p className="text-xl text-muted-foreground">暂无输出格式</p>
          <p className="mt-2 text-muted-foreground">点击"添加输出格式"按钮创建</p>
        </div>
      ) : (
        <div className="space-y-4">
          {formats.map((format) => (
            <div key={format.id} className="card p-5 animate-slideIn">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-card-foreground">{format.name}</h3>
                    <span className="badge badge-primary font-mono text-xs">{format.id}</span>
                  </div>
                  {format.description && (
                    <p className="text-sm text-muted-foreground">{format.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground/60">
                    <span>Schema 字段: {Object.keys(format.schema?.properties || {}).length}</span>
                    {format.sample_output && <span>有示例输出</span>}
                    {format.retry_prompt && <span>有重试提示</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => setViewingFormat(format)}
                    className="icon-btn"
                    title="查看详情"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => openEditModal(format)}
                    className="icon-btn"
                    title="编辑"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(format.id)}
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

      {/* 查看详情模态框 */}
      {viewingFormat && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-card-foreground">{viewingFormat.name}</h2>
                <span className="badge badge-primary font-mono text-xs mt-1">{viewingFormat.id}</span>
              </div>
              <button onClick={() => setViewingFormat(null)} className="icon-btn">✕</button>
            </div>

            {viewingFormat.description && (
              <p className="mb-4 text-muted-foreground">{viewingFormat.description}</p>
            )}

            <div className="space-y-4">
              <div className="card p-4 bg-accent/30">
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">JSON Schema</h3>
                <pre className="whitespace-pre-wrap text-sm font-mono p-4 rounded-xl overflow-x-auto bg-card border border-border text-card-foreground">
                  {JSON.stringify(viewingFormat.schema, null, 2)}
                </pre>
              </div>

              {viewingFormat.sample_output && (
                <div className="card p-4 bg-accent/30">
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">示例输出</h3>
                  <pre className="whitespace-pre-wrap text-sm font-mono p-4 rounded-xl overflow-x-auto bg-card border border-border text-card-foreground">
                    {viewingFormat.sample_output}
                  </pre>
                </div>
              )}

              {viewingFormat.retry_prompt && (
                <div className="card p-4 bg-accent/30">
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">重试提示词</h3>
                  <pre className="whitespace-pre-wrap text-sm p-4 rounded-xl overflow-x-auto bg-card border border-border text-card-foreground">
                    {viewingFormat.retry_prompt}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 添加/编辑模态框 */}
      {showAddModal && renderFormModal(true)}
      {editingFormat && renderFormModal(false)}
    </div>
  );
}
