"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "词语库", icon: "📖", desc: "浏览词语库" },
  { href: "/words/add", label: "添加词语", icon: "✏️", desc: "录入新词语" },
  { href: "/process", label: "处理词语", icon: "⚡", desc: "LLM 生成词条" },
  { href: "/tasks", label: "任务管理", icon: "📊", desc: "查看任务进度" },
  { href: "/postprocess", label: "后处理", icon: "🧩", desc: "插件增强词条" },
  { href: "/fields", label: "字段管理", icon: "📋", desc: "配置词条字段" },
  { href: "/kb", label: "知识库", icon: "📚", desc: "语料知识库" },
  { href: "/vendors", label: "供应商", icon: "🏢", desc: "LLM 供应商" },
  { href: "/prompts", label: "提示词", icon: "💬", desc: "系统提示词" },
  { href: "/output-formats", label: "输出格式", icon: "📐", desc: "JSON 输出格式" },
  { href: "/settings", label: "系统设置", icon: "⚙️", desc: "全局参数" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  if (!mounted) return null;

  return (
    <aside className="w-64 h-screen flex flex-col border-r border-border bg-card/80 backdrop-blur-xl sticky top-0">
      {/* Logo 区域 */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-primary/20">
            語
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              多语种语料
            </h1>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
              Corpus Manager
            </p>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            功能菜单
          </p>
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-primary/15 to-purple-500/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className={`text-base transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-105"}`}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium block ${isActive ? "text-primary" : ""}`}>
                  {item.label}
                </span>
                <span className="text-[10px] text-muted-foreground truncate block opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.desc}
                </span>
              </div>
              {isActive && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-sm shadow-primary/50" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* 底部 */}
      <div className="p-4 border-t border-border space-y-3">
        {/* 主题切换 */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 hover:bg-accent group"
          title={theme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
        >
          <span className="text-base transition-transform duration-300 group-hover:rotate-180">
            {theme === "dark" ? "☀️" : "🌙"}
          </span>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {theme === "dark" ? "亮色模式" : "暗色模式"}
          </span>
        </button>

        {/* 版本信息 */}
        <div className="flex items-center justify-between px-3">
          <span className="text-[10px] text-muted-foreground/60">v1.0.0</span>
          <span className="text-[10px] text-muted-foreground/60">Multilingual</span>
        </div>
      </div>
    </aside>
  );
}
