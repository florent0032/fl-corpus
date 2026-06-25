"use client";

import { useState, useEffect, useCallback } from "react";

const API = "/api/proxy";

interface TaskConfig {
  vendor_id: string;
  vendor_name: string;
  model: string;
  prompt_name: string;
  output_format_id: string;
  output_format_name: string;
  lang: string;
  lang_name: string;
  target_collections: { id: string; name: string }[];
}

interface TaskInfo {
  task_id: string | null;
  running: boolean;
  total: number;
  processed: number;
  success: number;
  failed: number;
  current_word: string;
  errors: string[];
  started_at: string | null;
  ended_at: string | null;
  config?: TaskConfig;
}

interface TaskWord {
  id: string;
  word: string;
  collection_id: string;
  status: string;
  error: string;
  started_at: string;
  ended_at: string | null;
}

interface TasksResponse {
  current: TaskInfo;
  history: TaskInfo[];
}

interface TaskDetailResponse {
  task: TaskInfo;
  words: TaskWord[];
}

interface ProcessedEntry {
  word: string;
  meaning_zh?: string;
  pron?: string;
  pos?: string;
  [key: string]: any;
}

export default function TasksPage() {
  const [currentTask, setCurrentTask] = useState<TaskInfo | null>(null);
  const [taskHistory, setTaskHistory] = useState<TaskInfo[]>([]);
  const [currentWords, setCurrentWords] = useState<TaskWord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewingTask, setViewingTask] = useState<TaskInfo | null>(null);
  const [viewingWords, setViewingWords] = useState<TaskWord[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "words" | "output">("overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showRetryModal, setShowRetryModal] = useState(false);

  // 输出查看
  const [outputCollections, setOutputCollections] = useState<string[]>([]);
  const [selectedOutputCollection, setSelectedOutputCollection] = useState("");
  const [outputEntries, setOutputEntries] = useState<ProcessedEntry[]>([]);
  const [outputSearchQuery, setOutputSearchQuery] = useState("");
  const [outputSortAsc, setOutputSortAsc] = useState(false);

  // 批量重新处理状态
  const [selectedDoneWords, setSelectedDoneWords] = useState<Set<string>>(new Set());
  const [isReprocessing, setIsReprocessing] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/process/tasks`);
      const data: TasksResponse = await res.json();
      setCurrentTask(data.current);
      setTaskHistory(data.history || []);
    } catch (e) {
      console.error("加载任务列表失败:", e);
    }
  }, []);

  const loadCurrentTaskWords = useCallback(async () => {
    try {
      const res = await fetch(`${API}/process/tasks/current`);
      const data: TaskDetailResponse = await res.json();
      setCurrentTask(data.task);
      setCurrentWords(data.words || []);
    } catch (e) {
      console.error("加载任务词语失败:", e);
    }
  }, []);

  const loadTaskDetail = async (taskId: string) => {
    try {
      const res = await fetch(`${API}/process/tasks/${taskId}`);
      const data: TaskDetailResponse = await res.json();
      setViewingTask(data.task);
      setViewingWords(data.words || []);
      setSelectedTaskId(taskId);
    } catch (e) {
      console.error("加载任务详情失败:", e);
    }
  };

  const loadOutputCollections = async () => {
    try {
      const res = await fetch(`${API}/languages`);
      const data = await res.json();
      const collections: string[] = [];
      for (const lang of data.items || []) {
        for (const col of lang.collections || []) {
          collections.push(col.id);
        }
      }
      setOutputCollections(collections);
    } catch (e) {
      console.error("加载词语库列表失败:", e);
    }
  };

  const loadOutputEntries = async (collectionId: string) => {
    try {
      const res = await fetch(`${API}/words/processed?collection_id=${collectionId}&size=1000`);
      const data = await res.json();
      setOutputEntries(data.items || []);
    } catch (e) {
      console.error("加载输出失败:", e);
    }
  };

  const handleStopTask = async () => {
    try {
      await fetch(`${API}/process/stop`, { method: "POST" });
    } catch (e) {
      console.error("停止失败:", e);
    }
  };

  const handleRetryImmediate = async () => {
    setShowRetryModal(false);
    try {
      const res = await fetch(`${API}/vendors`);
      const vendorData = await res.json();
      const vendors = vendorData.items || [];
      if (vendors.length === 0) {
        alert("没有可用的供应商，请先配置供应商");
        return;
      }
      const vendor = vendors[0];

      const retryRes = await fetch(`${API}/process/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendor.id,
          model: vendor.models?.[0] || "",
          lang: "",
          system_prompt_id: "",
          output_format_id: "",
          knowledge_bases: [],
          max_usages: 25,
          min_snippet_len: 15,
          word_ids: [],
        }),
      });

      const data = await retryRes.json();
      if (data.success === false) {
        alert(data.message);
      }
    } catch (e) {
      alert("重试失败");
    }
  };

  const handleResetToPending = async () => {
    setShowRetryModal(false);
    try {
      const res = await fetch(`${API}/process/reset-failed`, { method: "POST" });
      const data = await res.json();
      if (data.success === false) {
        alert(data.message);
      } else {
        loadCurrentTaskWords();
      }
    } catch (e) {
      alert("重置失败");
    }
  };

  // 单个词语：从词库删除并重新加入待处理队列
  const handleReprocessWord = async (taskWord: TaskWord) => {
    const confirmed = confirm(
      `确定要将词语 "${taskWord.word}" 从词库 ${taskWord.collection_id} 删除并重新加入待处理队列吗？`
    );
    if (!confirmed) return;

    try {
      setIsReprocessing(true);
      const res = await fetch(
        `${API}/words/processed/${taskWord.collection_id}/${encodeURIComponent(taskWord.word)}/reprocess`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();

      if (res.ok) {
        alert(`✅ ${data.message}`);
        // 刷新任务词语列表
        if (selectedTaskId) {
          loadTaskDetail(selectedTaskId);
        } else {
          loadCurrentTaskWords();
        }
      } else {
        alert(`❌ ${data.detail || data.message}`);
      }
    } catch (e) {
      alert("❌ 操作失败");
    } finally {
      setIsReprocessing(false);
    }
  };

  // 批量重新处理：从词库删除并重新加入待处理队列
  const handleBatchReprocess = async () => {
    if (selectedDoneWords.size === 0) {
      alert("请先选择要重新处理的词语");
      return;
    }

    const confirmed = confirm(
      `确定要将 ${selectedDoneWords.size} 个词语从词库删除并重新加入待处理队列吗？`
    );
    if (!confirmed) return;

    // 按 collection_id 分组
    const wordsByCollection: Record<string, string[]> = {};
    displayWords.forEach((w) => {
      if (selectedDoneWords.has(w.word) && w.status === "done") {
        if (!wordsByCollection[w.collection_id]) {
          wordsByCollection[w.collection_id] = [];
        }
        wordsByCollection[w.collection_id].push(w.word);
      }
    });

    try {
      setIsReprocessing(true);
      let totalRemoved = 0;
      let totalAdded = 0;

      // 对每个词库分别调用批量接口
      for (const [collectionId, words] of Object.entries(wordsByCollection)) {
        const res = await fetch(`${API}/words/processed/batch-reprocess`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            collection_id: collectionId,
            words: words,
          }),
        });
        const data = await res.json();

        if (res.ok && data.data) {
          totalRemoved += data.data.removed || 0;
          totalAdded += data.data.added || 0;
        } else {
          alert(`❌ 处理词库 ${collectionId} 失败: ${data.detail || data.message}`);
        }
      }

      alert(`✅ 成功将 ${totalRemoved} 个词语重新加入待处理队列（新增 ${totalAdded}）`);
      setSelectedDoneWords(new Set());

      // 刷新任务词语列表
      if (selectedTaskId) {
        loadTaskDetail(selectedTaskId);
      } else {
        loadCurrentTaskWords();
      }
    } catch (e) {
      alert("❌ 批量操作失败");
    } finally {
      setIsReprocessing(false);
    }
  };

  // 切换单个词语选中状态
  const toggleWordSelection = (word: string) => {
    setSelectedDoneWords((prev) => {
      const next = new Set(prev);
      if (next.has(word)) {
        next.delete(word);
      } else {
        next.add(word);
      }
      return next;
    });
  };

  // 全选/取消全选已处理词语
  const toggleSelectAllDone = () => {
    const doneWords = displayWords.filter((w) => w.status === "done");
    if (selectedDoneWords.size === doneWords.length) {
      setSelectedDoneWords(new Set());
    } else {
      setSelectedDoneWords(new Set(doneWords.map((w) => w.word)));
    }
  };

  // 初始加载
  useEffect(() => {
    loadTasks();
    loadCurrentTaskWords();
    loadOutputCollections();
  }, [loadTasks, loadCurrentTaskWords]);

  // 如果有正在运行的任务，定时刷新
  useEffect(() => {
    if (!currentTask?.running) return;
    const interval = setInterval(() => {
      loadTasks();
      loadCurrentTaskWords();
    }, 2000);
    return () => clearInterval(interval);
  }, [currentTask?.running, loadTasks, loadCurrentTaskWords]);

  // 加载输出内容
  useEffect(() => {
    if (selectedOutputCollection && activeTab === "output") {
      loadOutputEntries(selectedOutputCollection);
    }
  }, [selectedOutputCollection, activeTab]);

  // 当前显示的任务和词语
  const displayTask = selectedTaskId ? viewingTask : currentTask;
  const displayWords = selectedTaskId ? viewingWords : currentWords;

  // 筛选词语
  const filteredWords =
    statusFilter === "all"
      ? displayWords
      : displayWords.filter((w) => w.status === statusFilter);

  // 筛选和排序输出词条
  const filteredOutputEntries = (() => {
    let entries = outputEntries;

    // 搜索筛选
    if (outputSearchQuery.trim()) {
      const q = outputSearchQuery.trim().toLowerCase();
      entries = entries.filter(
        (e) =>
          (e.word || "").toLowerCase().includes(q) ||
          (e.meaning_zh || e.meaning || "").toLowerCase().includes(q)
      );
    }

    // 按时间顺序排序（正序=先添加的在前，倒序=后添加的在前）
    entries = [...entries].sort((a, b) => {
      const idxA = outputEntries.indexOf(a);
      const idxB = outputEntries.indexOf(b);
      return outputSortAsc ? idxA - idxB : idxB - idxA;
    });

    return entries;
  })();

  const progress = displayTask
    ? displayTask.total > 0
      ? (displayTask.processed / displayTask.total) * 100
      : 0
    : 0;

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start) return "-";
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("zh-CN");
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">任务管理</h1>
        <p className="mt-1 text-muted-foreground">查看处理任务的状态、进度和结果</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧：任务历史列表 */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 text-card-foreground">任务列表</h2>

            {/* 当前任务 */}
            {currentTask?.task_id && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1.5">当前任务</div>
                <button
                  onClick={() => {
                    setSelectedTaskId(null);
                    setViewingTask(null);
                    setViewingWords([]);
                  }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    !selectedTaskId
                      ? "bg-primary/10 border-primary/30"
                      : "bg-accent/50 border-border/50 hover:border-primary/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {currentTask.running && (
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">
                      {currentTask.running ? "进行中" : "已完成"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatTime(currentTask.started_at)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currentTask.success}/{currentTask.total} 成功
                  </div>
                </button>
              </div>
            )}

            {/* 历史任务 */}
            {taskHistory.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1.5">历史任务</div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {taskHistory.map((task, idx) => (
                    <button
                      key={task.task_id || idx}
                      onClick={() => loadTaskDetail(task.task_id!)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedTaskId === task.task_id
                          ? "bg-primary/10 border-primary/30"
                          : "bg-accent/50 border-border/50 hover:border-primary/20"
                      }`}
                    >
                      <div className="text-sm font-medium truncate">
                        任务 #{taskHistory.length - idx}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatTime(task.started_at)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {task.success}/{task.total} 成功
                        {task.failed > 0 && (
                          <span className="text-red-500 ml-1">· {task.failed} 失败</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!currentTask?.task_id && taskHistory.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">暂无任务</p>
                <p className="text-xs text-muted-foreground mt-1">请先创建处理任务</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：任务详情 */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tab 切换 */}
          <div className="flex gap-1 p-1 bg-accent rounded-xl">
            {[
              { key: "overview" as const, label: "任务概览" },
              { key: "words" as const, label: "词语列表" },
              { key: "output" as const, label: "查看输出" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 无任务提示 */}
          {!displayTask?.task_id && (
            <div className="card p-12 text-center">
              <p className="text-muted-foreground">请从左侧选择一个任务查看详情</p>
            </div>
          )}

          {/* 任务概览 Tab */}
          {activeTab === "overview" && displayTask?.task_id && (
            <div className="space-y-6">
              {/* 进度条 */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-card-foreground">
                    处理进度
                    {displayTask.running && (
                      <span className="ml-2 text-sm font-normal text-green-500">● 运行中</span>
                    )}
                    {!displayTask.running && displayTask.ended_at && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">已完成</span>
                    )}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {displayTask.processed} / {displayTask.total}
                  </span>
                </div>
                <div className="progress-bar h-4">
                  <div className="progress-fill h-full" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-right text-sm mt-1 text-muted-foreground">
                  {progress.toFixed(1)}%
                </div>
              </div>

              {/* 统计卡片 */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-6 text-center bg-green-500/5 border-green-500/20">
                  <div className="text-3xl font-bold text-green-500">{displayTask.success}</div>
                  <div className="text-sm text-muted-foreground mt-1">成功</div>
                </div>
                <div className="card p-6 text-center bg-red-500/5 border-red-500/20">
                  <div className="text-3xl font-bold text-red-500">{displayTask.failed}</div>
                  <div className="text-sm text-muted-foreground mt-1">失败</div>
                </div>
                <div className="card p-6 text-center bg-yellow-500/5 border-yellow-500/20">
                  <div className="text-3xl font-bold text-yellow-500">
                    {displayTask.total - displayTask.success - displayTask.failed}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">待处理</div>
                </div>
              </div>

              {/* 任务信息 */}
              <div className="card p-6">
                <h3 className="text-sm font-semibold mb-3 text-card-foreground">任务信息</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">任务 ID：</span>
                    <span className="font-mono text-xs">{displayTask.task_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">耗时：</span>
                    <span>{formatDuration(displayTask.started_at, displayTask.ended_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">开始时间：</span>
                    <span>{formatTime(displayTask.started_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">结束时间：</span>
                    <span>{formatTime(displayTask.ended_at)}</span>
                  </div>
                </div>

                {/* 配置信息 */}
                {displayTask.config && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h4 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">任务配置</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">供应商：</span>
                        <span>{displayTask.config.vendor_name || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">模型：</span>
                        <span className="font-mono text-xs">{displayTask.config.model || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">语言：</span>
                        <span>{displayTask.config.lang_name || "全部"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">输出格式：</span>
                        <span>{displayTask.config.output_format_name || "-"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">提示词：</span>
                        <span>{displayTask.config.prompt_name || "默认"}</span>
                      </div>
                      {displayTask.config.target_collections.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">目标词库：</span>
                          <span>
                            {displayTask.config.target_collections.map((c) => c.name).join("、")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 当前处理词 + 停止按钮 */}
              {displayTask.running && (
                <div className="space-y-3">
                  {displayTask.current_word && (
                    <div className="card p-4 border-l-4 border-primary">
                      <div className="text-sm text-muted-foreground">正在处理</div>
                      <div className="text-lg font-medium text-card-foreground">
                        {displayTask.current_word}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={handleStopTask}
                    className="w-full py-3 rounded-xl font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
                  >
                    ⏹️ 停止任务
                  </button>
                </div>
              )}

              {/* 失败/未处理词语操作按钮 */}
              {!displayTask.running && (() => {
                const failedCount = displayWords.filter((w) => w.status === "failed").length;
                const unprocessedCount = displayWords.filter((w) => w.status === "processing").length;
                const doneCount = displayWords.filter((w) => w.status === "done").length;
                const totalCount = failedCount + unprocessedCount;
                if (totalCount === 0 && doneCount === 0) return null;
                return (
                  <div className="space-y-3">
                    {totalCount > 0 && selectedTaskId === null && (
                      <button
                        onClick={() => setShowRetryModal(true)}
                        className="w-full py-3 rounded-xl font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                      >
                        🔄 处理 {totalCount} 个未完成词语
                        {failedCount > 0 && unprocessedCount > 0 && (
                          <span className="text-xs ml-1">（{failedCount} 失败 + {unprocessedCount} 未处理）</span>
                        )}
                      </button>
                    )}
                    {doneCount > 0 && (
                      <button
                        onClick={() => {
                          setStatusFilter("done");
                          setActiveTab("words");
                        }}
                        className="w-full py-3 rounded-xl font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
                      >
                        📋 查看 {doneCount} 个已处理词语
                        <span className="text-xs ml-1">（可在词语列表中选择重新处理）</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* 错误列表 */}
              {displayTask.errors.length > 0 && (
                <div className="card p-6">
                  <h3 className="text-sm font-semibold mb-3 text-card-foreground">
                    错误详情（{displayTask.errors.length}）
                  </h3>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {displayTask.errors.map((error, i) => (
                      <div
                        key={i}
                        className="card p-3 text-sm border-l-4 border-red-500 text-red-500 font-mono"
                      >
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 词语列表 Tab */}
          {activeTab === "words" && displayTask?.task_id && (
            <div className="space-y-4">
              {/* 筛选栏 */}
              <div className="card p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground">状态筛选：</span>
                  {[
                    { key: "all", label: "全部", count: displayWords.length },
                    { key: "done", label: "成功", count: displayWords.filter((w) => w.status === "done").length },
                    { key: "failed", label: "失败", count: displayWords.filter((w) => w.status === "failed").length },
                    { key: "processing", label: "处理中", count: displayWords.filter((w) => w.status === "processing").length },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setStatusFilter(f.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        statusFilter === f.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-accent-foreground hover:bg-secondary"
                      }`}
                    >
                      {f.label}（{f.count}）
                    </button>
                  ))}
                </div>
              </div>

              {/* 批量操作栏（仅当有已处理词语且任务已完成时显示） */}
              {!displayTask.running &&
                displayWords.some((w) => w.status === "done") && (
                  <div className="card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={toggleSelectAllDone}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                        >
                          {selectedDoneWords.size === displayWords.filter((w) => w.status === "done").length
                            ? "取消全选"
                            : "全选已处理"}
                        </button>
                        {selectedDoneWords.size > 0 && (
                          <span className="text-sm text-muted-foreground">
                            已选择 {selectedDoneWords.size} 个词语
                          </span>
                        )}
                      </div>
                      {selectedDoneWords.size > 0 && (
                        <button
                          onClick={handleBatchReprocess}
                          disabled={isReprocessing}
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border border-amber-500/20 disabled:opacity-50"
                        >
                          {isReprocessing ? "处理中..." : `🔄 重新处理 (${selectedDoneWords.size})`}
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* 词语列表 */}
              {filteredWords.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-muted-foreground">暂无词语</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredWords.map((w, i) => (
                    <div
                      key={w.id || i}
                      className={`card p-4 border-l-4 ${
                        w.status === "done"
                          ? "border-l-green-500"
                          : w.status === "failed"
                          ? "border-l-red-500"
                          : "border-l-yellow-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {/* 批量选择复选框（仅已处理词语且任务未运行时显示） */}
                            {!displayTask.running && w.status === "done" && (
                              <input
                                type="checkbox"
                                checked={selectedDoneWords.has(w.word)}
                                onChange={() => toggleWordSelection(w.word)}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                              />
                            )}
                            <span className="font-medium text-card-foreground">{w.word}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                w.status === "done"
                                  ? "bg-green-500/10 text-green-500"
                                  : w.status === "failed"
                                  ? "bg-red-500/10 text-red-500"
                                  : "bg-yellow-500/10 text-yellow-500"
                              }`}
                            >
                              {w.status === "done"
                                ? "成功"
                                : w.status === "failed"
                                ? "失败"
                                : "处理中"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {w.collection_id}
                            </span>
                          </div>
                          {w.error && (
                            <div className="text-xs text-red-500 mt-1 font-mono truncate">
                              {w.error}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                          {/* 重新处理按钮（仅已处理词语且任务未运行时显示） */}
                          {!displayTask.running && w.status === "done" && (
                            <button
                              onClick={() => handleReprocessWord(w)}
                              disabled={isReprocessing}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border border-amber-500/20 disabled:opacity-50"
                              title="从词库删除并重新加入待处理队列"
                            >
                              🔄 重新处理
                            </button>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {w.ended_at
                              ? formatDuration(w.started_at, w.ended_at)
                              : w.started_at
                              ? "..."
                              : ""}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 失败/未处理重试按钮 */}
              {!displayTask.running &&
                displayWords.some((w) => w.status === "failed" || w.status === "processing") &&
                selectedTaskId === null && (
                  <button
                    onClick={() => setShowRetryModal(true)}
                    className="w-full py-3 rounded-xl font-medium bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors border border-amber-500/20"
                  >
                    🔄 处理所有未完成词语
                  </button>
                )}
            </div>
          )}

          {/* 查看输出 Tab */}
          {activeTab === "output" && (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex items-center gap-4">
                  <label className="text-sm text-muted-foreground">选择词语库：</label>
                  <select
                    value={selectedOutputCollection}
                    onChange={(e) => setSelectedOutputCollection(e.target.value)}
                    className="select flex-1"
                  >
                    <option value="">请选择</option>
                    {outputCollections.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {selectedOutputCollection && (
                    <button
                      onClick={() => loadOutputEntries(selectedOutputCollection)}
                      className="px-4 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:bg-secondary transition-colors"
                    >
                      刷新
                    </button>
                  )}
                </div>
              </div>

              {!selectedOutputCollection ? (
                <div className="card p-12 text-center">
                  <p className="text-muted-foreground">请选择一个词语库查看输出</p>
                </div>
              ) : outputEntries.length === 0 ? (
                <div className="card p-12 text-center">
                  <p className="text-muted-foreground">该词语库暂无已处理词条</p>
                </div>
              ) : (
                <>
                  {/* 搜索和排序 */}
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={outputSearchQuery}
                          onChange={(e) => setOutputSearchQuery(e.target.value)}
                          placeholder="搜索词语或意思..."
                          className="input w-full pr-8"
                        />
                        {outputSearchQuery && (
                          <button
                            onClick={() => setOutputSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            title="清除"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setOutputSortAsc(!outputSortAsc)}
                        className="px-3 py-2 rounded-lg text-sm bg-accent text-accent-foreground hover:bg-secondary transition-colors flex items-center gap-1"
                        title={outputSortAsc ? "当前：正序（先添加在前），点击切换" : "当前：倒序（后添加在前），点击切换"}
                      >
                        排序 {outputSortAsc ? "↑" : "↓"}
                      </button>
                    </div>
                  </div>

                  {/* 词条列表 */}
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      共 {filteredOutputEntries.length} 个词条
                      {outputSearchQuery && `（筛选自 ${outputEntries.length} 个）`}
                    </div>
                    {filteredOutputEntries.length === 0 ? (
                      <div className="card p-8 text-center">
                        <p className="text-muted-foreground">没有匹配的词条</p>
                      </div>
                    ) : (
                      filteredOutputEntries.map((entry, i) => (
                        <details key={i} className="card">
                          <summary className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                            <span className="font-medium">{entry.word}</span>
                            {entry.pron && (
                              <span className="ml-2 text-sm text-muted-foreground">{entry.pron}</span>
                            )}
                            {entry.pos && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                {entry.pos}
                              </span>
                            )}
                            {entry.meaning_zh && (
                              <span className="ml-2 text-sm text-muted-foreground">
                                {entry.meaning_zh}
                              </span>
                            )}
                          </summary>
                          <div className="px-4 pb-4">
                            <pre className="text-xs bg-accent/50 p-3 rounded-lg overflow-x-auto font-mono whitespace-pre-wrap">
                              {JSON.stringify(entry, null, 2)}
                            </pre>
                          </div>
                        </details>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 重试失败/未处理词语弹窗 */}
      {showRetryModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center z-50 animate-fadeIn">
          <div className="card p-6 w-full max-w-md animate-scaleIn">
            <h2 className="text-xl font-bold text-card-foreground mb-2">处理未完成词语</h2>
            <p className="text-sm text-muted-foreground mb-6">
              当前任务有 {displayWords.filter((w) => w.status === "failed").length} 个失败、
              {displayWords.filter((w) => w.status === "processing").length} 个未处理词语，
              请选择处理方式：
            </p>

            <div className="space-y-3">
              <button
                onClick={handleRetryImmediate}
                className="w-full p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
              >
                <div className="font-medium text-card-foreground">🚀 立即重试</div>
                <div className="text-sm text-muted-foreground mt-1">
                  按原配置（供应商、模型、提示词）立即启动新任务重试
                </div>
              </button>

              <button
                onClick={handleResetToPending}
                className="w-full p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-left"
              >
                <div className="font-medium text-card-foreground">📋 重置为待处理</div>
                <div className="text-sm text-muted-foreground mt-1">
                  将失败词语放回待处理列表，稍后自行决定是否新建任务处理
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowRetryModal(false)}
              className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
