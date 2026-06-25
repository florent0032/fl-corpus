"use client";

import { useState, useEffect } from "react";

const API = "/api/proxy";

interface Vendor {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  models: string[];
  enabled: boolean;
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [message, setMessage] = useState("");
  const [testingModel, setTestingModel] = useState<string>("");
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; msg: string }>>({});

  // 表单状态
  const [form, setForm] = useState({
    id: "",
    name: "",
    provider_type: "openai_compatible",
    base_url: "",
    api_key: "",
    enabled: true,
  });

  // 模型添加状态
  const [newModel, setNewModel] = useState<Record<string, string>>({});

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/vendors`);
      const data = await res.json();
      setVendors(data.items || []);
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
      provider_type: "openai_compatible",
      base_url: "",
      api_key: "",
      enabled: true,
    });
  };

  const handleAdd = async () => {
    if (!form.id || !form.name || !form.base_url) {
      setMessage("❌ 请填写必填字段（ID、名称、API 地址）");
      return;
    }

    try {
      const res = await fetch(`${API}/vendors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 供应商添加成功");
        setShowAddModal(false);
        resetForm();
        loadVendors();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleEdit = async () => {
    if (!editingVendor) return;

    try {
      const body: any = {};
      if (form.name) body.name = form.name;
      if (form.base_url) body.base_url = form.base_url;
      if (form.api_key) body.api_key = form.api_key;
      body.provider_type = form.provider_type;
      body.enabled = form.enabled;

      const res = await fetch(`${API}/vendors/${editingVendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 供应商更新成功");
        setEditingVendor(null);
        resetForm();
        loadVendors();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleDelete = async (vendorId: string) => {
    if (!confirm("确定删除这个供应商吗？")) return;

    try {
      const res = await fetch(`${API}/vendors/${vendorId}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("✅ 供应商删除成功");
        loadVendors();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleAddModel = async (vendorId: string) => {
    const model = (newModel[vendorId] || "").trim();
    if (!model) return;

    try {
      const res = await fetch(`${API}/vendors/${vendorId}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage(`✅ 模型 ${model} 添加成功`);
        setNewModel({ ...newModel, [vendorId]: "" });
        loadVendors();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleDeleteModel = async (vendorId: string, model: string) => {
    if (!confirm(`确定删除模型 ${model} 吗？`)) return;

    try {
      const res = await fetch(`${API}/vendors/${vendorId}/models/${encodeURIComponent(model)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage(`✅ 模型 ${model} 删除成功`);
        loadVendors();
      } else {
        const data = await res.json();
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleTestModel = async (vendorId: string, model: string) => {
    const key = `${vendorId}:${model}`;
    setTestingModel(key);
    setTestResults({ ...testResults, [key]: { success: false, msg: "测试中..." } });

    try {
      const res = await fetch(`${API}/vendors/${vendorId}/models/${encodeURIComponent(model)}/test`, {
        method: "POST",
      });
      const data = await res.json();

      setTestResults({
        ...testResults,
        [key]: {
          success: data.success !== false,
          msg: data.message || "测试完成",
        },
      });
    } catch (e) {
      setTestResults({
        ...testResults,
        [key]: { success: false, msg: "网络错误" },
      });
    } finally {
      setTestingModel("");
    }
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setForm({
      id: vendor.id,
      name: vendor.name,
      provider_type: vendor.provider_type,
      base_url: vendor.base_url,
      api_key: "",
      enabled: vendor.enabled,
    });
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">供应商管理</h1>
            <p className="mt-1 text-muted-foreground">管理 LLM 供应商配置、模型和连接测试</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="btn-gradient px-5 py-2.5 rounded-xl font-medium"
          >
            + 添加供应商
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
      ) : vendors.length === 0 ? (
        <div className="text-center py-16 card">
          <div className="text-4xl mb-4">🏢</div>
          <p className="text-xl text-muted-foreground">暂无供应商</p>
          <p className="mt-2 text-muted-foreground">点击"添加供应商"按钮开始配置</p>
        </div>
      ) : (
        <div className="space-y-6">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="card p-6 animate-slideIn">
              {/* 供应商头部 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                    🏢
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-card-foreground">{vendor.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{vendor.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge ${vendor.enabled ? "badge-success" : "badge-error"}`}>
                    {vendor.enabled ? "已启用" : "已禁用"}
                  </span>
                  <button
                    onClick={() => openEditModal(vendor)}
                    className="icon-btn"
                    title="编辑"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(vendor.id)}
                    className="icon-btn hover:!bg-red-500/10 hover:!text-red-500"
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* 供应商信息 */}
              <div className="grid grid-cols-2 gap-4 mb-5 p-4 rounded-xl bg-accent/50">
                <div>
                  <label className="text-xs text-muted-foreground">API 地址</label>
                  <p className="font-mono text-sm mt-1 text-card-foreground break-all">{vendor.base_url}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">API 密钥</label>
                  <p className="font-mono text-sm mt-1 text-card-foreground">{vendor.api_key}</p>
                </div>
              </div>

              {/* 模型管理 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-foreground">模型列表</label>
                </div>

                {/* 添加模型 */}
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newModel[vendor.id] || ""}
                    onChange={(e) => setNewModel({ ...newModel, [vendor.id]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleAddModel(vendor.id)}
                    placeholder="输入模型名称，按回车添加"
                    className="input flex-1"
                  />
                  <button
                    onClick={() => handleAddModel(vendor.id)}
                    className="btn-success px-4 py-2 rounded-xl text-sm font-medium"
                  >
                    + 添加
                  </button>
                </div>

                {/* 模型列表 */}
                {vendor.models.length > 0 ? (
                  <div className="space-y-2">
                    {vendor.models.map((model) => {
                      const testKey = `${vendor.id}:${model}`;
                      const result = testResults[testKey];
                      return (
                        <div
                          key={model}
                          className="flex items-center justify-between p-3 rounded-xl bg-accent/30 border border-border/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-card-foreground">{model}</span>
                            {result && (
                              <span className={`text-xs ${result.success ? "text-green-500" : "text-red-500"}`}>
                                {result.msg}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTestModel(vendor.id, model)}
                              disabled={testingModel === testKey}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                            >
                              {testingModel === testKey ? "测试中..." : "🔍 测试"}
                            </button>
                            <button
                              onClick={() => handleDeleteModel(vendor.id, model)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-3 text-center">暂无模型，请添加</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加/编辑供应商模态框 */}
      {(showAddModal || editingVendor) && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-lg animate-scaleIn">
            <h2 className="text-xl font-bold mb-6 text-card-foreground">
              {editingVendor ? "编辑供应商" : "添加供应商"}
            </h2>

            <div className="space-y-4">
              {!editingVendor && (
                <div>
                  <label className="block text-sm mb-1.5 text-muted-foreground">供应商 ID *</label>
                  <input
                    type="text"
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    placeholder="如: openai, deepseek"
                    className="input w-full"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="供应商名称"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">API 地址 *</label>
                <input
                  type="text"
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">API 密钥</label>
                <input
                  type="password"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                  placeholder={editingVendor ? "留空则不修改" : "sk-..."}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm mb-1.5 text-muted-foreground">供应商类型</label>
                <select
                  value={form.provider_type}
                  onChange={(e) => setForm({ ...form, provider_type: e.target.value })}
                  className="select w-full"
                >
                  <option value="openai_compatible">OpenAI 兼容</option>
                  <option value="custom">自定义</option>
                </select>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-sm text-foreground">启用此供应商</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingVendor(null);
                  resetForm();
                }}
                className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={editingVendor ? handleEdit : handleAdd}
                className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-medium"
              >
                {editingVendor ? "保存修改" : "添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
