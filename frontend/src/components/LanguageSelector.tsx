"use client";

import { useState, useRef, useEffect } from "react";
import {
  LanguageOption,
  WORLD_LANGUAGES,
  searchLanguages,
  getLanguageByCode,
  getPopularLanguages,
} from "@/lib/languages";

interface LanguageSelectorProps {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  label?: string;
  showNative?: boolean;
  className?: string;
}

export function LanguageSelector({
  value,
  onChange,
  placeholder = "选择语言...",
  label,
  showNative = true,
  className = "",
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLang = value ? getLanguageByCode(value) : null;
  const popularLangs = getPopularLanguages();

  // 搜索结果
  const filteredLangs = searchQuery
    ? searchLanguages(searchQuery)
    : WORLD_LANGUAGES;

  // 显示的语言列表（无搜索时显示常用语言 + 全部）
  const displayLangs = searchQuery
    ? filteredLangs
    : [...popularLangs, ...WORLD_LANGUAGES.filter((l) => !popularLangs.includes(l))];

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, displayLangs.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (displayLangs[highlightedIndex]) {
          onChange(displayLangs[highlightedIndex].code);
          setIsOpen(false);
          setSearchQuery("");
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchQuery("");
        break;
    }
  };

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm mb-1.5 text-muted-foreground">{label}</label>
      )}

      {/* 选择框 */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
          }
        }}
        className="w-full input flex items-center justify-between cursor-pointer"
      >
        <span className={selectedLang ? "text-foreground" : "text-muted-foreground"}>
          {selectedLang ? (
            <>
              <span>{selectedLang.name}</span>
              <span className="text-muted-foreground ml-2 text-sm">
                {selectedLang.nameEn}
              </span>
              {showNative && selectedLang.native && selectedLang.native !== selectedLang.name && (
                <span className="text-muted-foreground ml-2 text-sm">
                  ({selectedLang.native})
                </span>
              )}
            </>
          ) : (
            placeholder
          )}
        </span>
        <span className="text-muted-foreground">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-80 overflow-hidden animate-scaleIn">
          {/* 搜索框 */}
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="搜索语言（中文/英文/本地名）..."
              className="input w-full text-sm"
            />
          </div>

          {/* 语言列表 */}
          <div className="overflow-y-auto max-h-64">
            {!searchQuery && (
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                常用语言
              </div>
            )}

            {displayLangs.length === 0 ? (
              <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                未找到匹配的语言
              </div>
            ) : (
              displayLangs.map((lang, index) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                    index === highlightedIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-accent"
                  } ${value === lang.code ? "bg-primary/5" : ""}`}
                >
                  <span className="text-xs font-mono text-muted-foreground w-8">
                    {lang.code}
                  </span>
                  <span className="font-medium">{lang.name}</span>
                  <span className="text-sm text-muted-foreground">{lang.nameEn}</span>
                  {showNative && lang.native && lang.native !== lang.name && (
                    <span className="text-sm text-muted-foreground ml-auto">
                      {lang.native}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 多选语言选择器
 */
interface MultiLanguageSelectorProps {
  value: string[];
  onChange: (codes: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function MultiLanguageSelector({
  value,
  onChange,
  placeholder = "选择适用语言...",
  label,
  className = "",
}: MultiLanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredLangs = searchQuery
    ? searchLanguages(searchQuery)
    : WORLD_LANGUAGES;

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleLanguage = (code: string) => {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const removeLanguage = (code: string) => {
    onChange(value.filter((c) => c !== code));
  };

  const selectedLangs = value
    .map((code) => getLanguageByCode(code))
    .filter(Boolean) as LanguageOption[];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm mb-1.5 text-muted-foreground">{label}</label>
      )}

      {/* 选择框 */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full input flex flex-wrap gap-1.5 min-h-[42px] cursor-pointer"
      >
        {selectedLangs.length === 0 ? (
          <span className="text-muted-foreground">{placeholder}</span>
        ) : (
          selectedLangs.map((lang) => (
            <span
              key={lang.code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-sm"
            >
              {lang.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLanguage(lang.code);
                }}
                className="hover:text-primary/70"
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-80 overflow-hidden animate-scaleIn">
          {/* 搜索框 */}
          <div className="p-2 border-b border-border">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索语言..."
              className="input w-full text-sm"
            />
          </div>

          {/* 全选/清空 */}
          <div className="flex gap-2 px-3 py-1.5 border-b border-border">
            <button
              type="button"
              onClick={() => onChange(filteredLangs.map((l) => l.code))}
              className="text-xs text-primary hover:underline"
            >
              全选
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:underline"
            >
              清空
            </button>
            <span className="text-xs text-muted-foreground ml-auto">
              已选 {value.length} 种
            </span>
          </div>

          {/* 语言列表 */}
          <div className="overflow-y-auto max-h-56">
            {filteredLangs.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors hover:bg-accent ${
                  value.includes(lang.code) ? "bg-primary/5" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={value.includes(lang.code)}
                  readOnly
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-xs font-mono text-muted-foreground w-8">
                  {lang.code}
                </span>
                <span className="font-medium text-card-foreground">{lang.name}</span>
                <span className="text-sm text-muted-foreground">{lang.nameEn}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
