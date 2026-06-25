"use client";

import { useState, useEffect } from "react";
import { MultiLanguageSelector } from "@/components/LanguageSelector";

const API = "/api/proxy";

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

const FIELD_TYPES = [
  { value: "text", label: "文本" },
  { value: "textarea", label: "文本域" },
  { value: "select", label: "下拉选择" },
  { value: "json", label: "JSON" },
];

export default function FieldsPage() {
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingField, setEditingField] = useState<FieldConfig | null>(null);
  const [message, setMessage] = useState("");

  const [newField, setNewField] = useState({
    id: "",
    name: "",
    name_en: "",
    field_type: "text",
    languages: [] as string[],
    default_enabled: false,
    default_value: "",
    placeholder: "",
    description: "",
  });

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API}/fields`);
      const data = await res.json();
      setFields(data.items || []);
    } catch (e) {
      console.error("加载字段失败:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddField = async () => {
    if (!newField.id || !newField.name) {
      setMessage("❌ 请填写字段 ID 和名称");
      return;
    }

    try {
      const res = await fetch(`${API}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newField),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 字段添加成功");
        setShowAddForm(false);
        resetForm();
        loadFields();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleUpdateField = async () => {
    if (!editingField) return;

    try {
      const res = await fetch(`${API}/fields/${editingField.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingField.name,
          name_en: editingField.name_en,
          field_type: editingField.field_type,
          languages: editingField.languages,
          default_enabled: editingField.default_enabled,
          placeholder: editingField.placeholder,
          description: editingField.description,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 字段更新成功");
        setEditingField(null);
        loadFields();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("确定删除这个字段吗？")) return;

    try {
      const res = await fetch(`${API}/fields/${fieldId}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setMessage("✅ 字段删除成功");
        loadFields();
      } else {
        setMessage(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      setMessage("❌ 网络错误");
    }
  };

  const resetForm = () => {
    setNewField({
      id: "",
      name: "",
      name_en: "",
      field_type: "text",
      languages: [],
      default_enabled: false,
      placeholder: "",
      description: "",
    });
  };

  const presetFields = fields.filter((f) => f.is_preset);
  const customFields = fields.filter((f) => !f.is_preset);

  const renderFieldForm = (
    field: typeof newField | FieldConfig,
    isNew: boolean,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <div className="card p-6 animate-slideIn">
      <h2 className="text-xl font-semibold mb-4 text-card-foreground">
        {isNew ? "添加自定义字段" : "编辑字段"}
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground">字段 ID *</label>
            <input
              type="text"
              value={field.id}
              onChange={(e) => isNew ? setNewField({ ...newField, id: e.target.value }) : undefined}
              placeholder="如: custom_field"
              className="input w-full"
              disabled={!isNew}
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground">字段类型</label>
            <select
              value={field.field_type}
              onChange={(e) => isNew
                ? setNewField({ ...newField, field_type: e.target.value })
                : setEditingField({ ...editingField!, field_type: e.target.value })
              }
              className="select w-full"
            >
              {FIELD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground">名称 *</label>
            <input
              type="text"
              value={field.name}
              onChange={(e) => isNew
                ? setNewField({ ...newField, name: e.target.value })
                : setEditingField({ ...editingField!, name: e.target.value })
              }
              placeholder="中文名称"
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm mb-1.5 text-muted-foreground">英文名称</label>
            <input
              type="text"
              value={field.name_en}
              onChange={(e) => isNew
                ? setNewField({ ...newField, name_en: e.target.value })
                : setEditingField({ ...editingField!, name_en: e.target.value })
              }
              placeholder="English Name"
              className="input w-full"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1.5 text-muted-foreground">占位符</label>
          <input
            type="text"
            value={field.placeholder}
            onChange={(e) => isNew
              ? setNewField({ ...newField, placeholder: e.target.value })
              : setEditingField({ ...editingField!, placeholder: e.target.value })
            }
            placeholder="输入框占位符"
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-sm mb-1.5 text-muted-foreground">描述</label>
          <textarea
            value={field.description}
            onChange={(e) => isNew
              ? setNewField({ ...newField, description: e.target.value })
              : setEditingField({ ...editingField!, description: e.target.value })
            }
            placeholder="字段描述"
            className="input w-full"
            rows={2}
          />
        </div>

        {/* 语言选择器 */}
        <MultiLanguageSelector
          value={field.languages}
          onChange={(langs) => isNew
            ? setNewField({ ...newField, languages: langs })
            : setEditingField({ ...editingField!, languages: langs })
          }
          label="适用语言（留空表示所有语言）"
          placeholder="选择适用语言（留空表示所有语言）..."
        />

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={field.default_enabled}
            onChange={(e) => isNew
              ? setNewField({ ...newField, default_enabled: e.target.checked })
              : setEditingField({ ...editingField!, default_enabled: e.target.checked })
            }
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-sm text-foreground">默认启用</span>
        </label>

        <div>
          <label className="block text-sm mb-1.5 text-muted-foreground">
            默认值
            <span className="text-xs text-muted-foreground/60 ml-2">（设置后无需填写此字段）</span>
          </label>
          <input
            type="text"
            value={field.default_value || ""}
            onChange={(e) => isNew
              ? setNewField({ ...newField, default_value: e.target.value })
              : setEditingField({ ...editingField!, default_value: e.target.value })
            }
            placeholder="留空表示无默认值"
            className="input w-full"
          />
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-6">
        <button
          onClick={onCancel}
          className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-medium"
        >
          取消
        </button>
        <button onClick={onSave} className="btn-gradient px-5 py-2.5 rounded-xl text-sm font-medium">
          {isNew ? "添加" : "保存"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">字段管理</h1>
            <p className="mt-1 text-muted-foreground">管理添加词语时的可选字段</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-gradient px-5 py-2.5 rounded-xl font-medium">
            + 添加自定义字段
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
      ) : (
        <div className="space-y-8">
          {/* 预设字段 */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              预设字段
              <span className="badge badge-primary ml-2">{presetFields.length}</span>
            </h2>
            <p className="text-sm mb-4 text-muted-foreground">预设字段不可删除，只能修改启用状态和适用语言</p>

            <div className="space-y-4">
              {presetFields.map((field) => (
                <div key={field.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-card-foreground">{field.name}</span>
                        <span className="text-sm text-muted-foreground">{field.name_en}</span>
                        <span className="badge badge-primary">{field.field_type}</span>
                        {field.is_preset && <span className="badge badge-warning">预设</span>}
                      </div>
                      {field.description && (
                        <p className="text-sm mt-1 text-muted-foreground">{field.description}</p>
                      )}
                      {field.languages.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {field.languages.map((lang) => (
                            <span key={lang} className="badge badge-primary text-xs">
                              {lang}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.default_enabled}
                          onChange={async () => {
                            await fetch(`${API}/fields/${field.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ default_enabled: !field.default_enabled }),
                            });
                            loadFields();
                          }}
                          className="w-4 h-4 rounded accent-primary"
                        />
                        <span className="text-sm text-foreground">默认启用</span>
                      </label>
                      <button
                        onClick={() => setEditingField(field)}
                        className="px-3 py-1.5 rounded-lg text-sm bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 自定义字段 */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              自定义字段
              <span className="badge badge-primary ml-2">{customFields.length}</span>
            </h2>

            {customFields.length === 0 ? (
              <div className="card p-8 text-center">
                <p className="text-muted-foreground">暂无自定义字段</p>
                <p className="text-sm mt-2 text-muted-foreground">点击"添加自定义字段"按钮创建</p>
              </div>
            ) : (
              <div className="space-y-4">
                {customFields.map((field) => (
                  <div key={field.id} className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-card-foreground">{field.name}</span>
                          <span className="text-sm text-muted-foreground">{field.name_en}</span>
                          <span className="badge badge-primary">{field.field_type}</span>
                        </div>
                        {field.description && (
                          <p className="text-sm mt-1 text-muted-foreground">{field.description}</p>
                        )}
                        {field.languages.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {field.languages.map((lang) => (
                              <span key={lang} className="badge badge-primary text-xs">
                                {lang}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingField(field)}
                          className="px-3 py-1.5 rounded-lg text-sm bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="px-3 py-1.5 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 添加字段弹窗 */}
      {showAddForm && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50">
          {renderFieldForm(newField, true, handleAddField, () => {
            setShowAddForm(false);
            resetForm();
          })}
        </div>
      )}

      {/* 编辑字段弹窗 */}
      {editingField && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50">
          {renderFieldForm(editingField, false, handleUpdateField, () => setEditingField(null))}
        </div>
      )}
    </div>
  );
}
