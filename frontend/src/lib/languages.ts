/**
 * 世界语言列表
 * 包含语言代码、中文名称、英文名称
 * 按使用人口排序
 */

export interface LanguageOption {
  code: string;
  name: string;      // 中文名
  nameEn: string;    // 英文名
  native?: string;   // 本地名称
}

export const WORLD_LANGUAGES: LanguageOption[] = [
  // 东亚
  { code: "zh", name: "中文", nameEn: "Chinese", native: "中文" },
  { code: "zh-CN", name: "简体中文", nameEn: "Simplified Chinese", native: "简体中文" },
  { code: "zh-TW", name: "繁体中文", nameEn: "Traditional Chinese", native: "繁體中文" },
  { code: "ja", name: "日语", nameEn: "Japanese", native: "日本語" },
  { code: "ko", name: "韩语", nameEn: "Korean", native: "한국어" },

  // 南亚
  { code: "hi", name: "印地语", nameEn: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "孟加拉语", nameEn: "Bengali", native: "বাংলা" },
  { code: "ur", name: "乌尔都语", nameEn: "Urdu", native: "اردو" },
  { code: "ta", name: "泰米尔语", nameEn: "Tamil", native: "தமிழ்" },
  { code: "te", name: "泰卢固语", nameEn: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "马拉地语", nameEn: "Marathi", native: "मराठी" },
  { code: "gu", name: "古吉拉特语", nameEn: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "卡纳达语", nameEn: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", name: "马拉雅拉姆语", nameEn: "Malayalam", native: "മലയാളം" },
  { code: "pa", name: "旁遮普语", nameEn: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "si", name: "僧伽罗语", nameEn: "Sinhala", native: "සිංහල" },
  { code: "ne", name: "尼泊尔语", nameEn: "Nepali", native: "नेपाली" },

  // 东南亚
  { code: "id", name: "印尼语", nameEn: "Indonesian", native: "Bahasa Indonesia" },
  { code: "ms", name: "马来语", nameEn: "Malay", native: "Bahasa Melayu" },
  { code: "th", name: "泰语", nameEn: "Thai", native: "ภาษาไทย" },
  { code: "vi", name: "越南语", nameEn: "Vietnamese", native: "Tiếng Việt" },
  { code: "fil", name: "菲律宾语", nameEn: "Filipino", native: "Filipino" },
  { code: "my", name: "缅甸语", nameEn: "Burmese", native: "မြန်မာစာ" },
  { code: "km", name: "高棉语", nameEn: "Khmer", native: "ភាសាខ្មែរ" },
  { code: "lo", name: "老挝语", nameEn: "Lao", native: "ພາສາລາວ" },

  // 西亚/中东
  { code: "ar", name: "阿拉伯语", nameEn: "Arabic", native: "العربية" },
  { code: "fa", name: "波斯语", nameEn: "Persian", native: "فارسی" },
  { code: "tr", name: "土耳其语", nameEn: "Turkish", native: "Türkçe" },
  { code: "he", name: "希伯来语", nameEn: "Hebrew", native: "עברית" },
  { code: "ku", name: "库尔德语", nameEn: "Kurdish", native: "کوردی" },
  { code: "ps", name: "普什图语", nameEn: "Pashto", native: "پښتو" },

  // 欧洲 - 日耳曼语族
  { code: "en", name: "英语", nameEn: "English", native: "English" },
  { code: "de", name: "德语", nameEn: "German", native: "Deutsch" },
  { code: "nl", name: "荷兰语", nameEn: "Dutch", native: "Nederlands" },
  { code: "sv", name: "瑞典语", nameEn: "Swedish", native: "Svenska" },
  { code: "no", name: "挪威语", nameEn: "Norwegian", native: "Norsk" },
  { code: "da", name: "丹麦语", nameEn: "Danish", native: "Dansk" },
  { code: "is", name: "冰岛语", nameEn: "Icelandic", native: "Íslenska" },
  { code: "af", name: "南非荷兰语", nameEn: "Afrikaans", native: "Afrikaans" },

  // 欧洲 - 罗曼语族
  { code: "es", name: "西班牙语", nameEn: "Spanish", native: "Español" },
  { code: "fr", name: "法语", nameEn: "French", native: "Français" },
  { code: "pt", name: "葡萄牙语", nameEn: "Portuguese", native: "Português" },
  { code: "it", name: "意大利语", nameEn: "Italian", native: "Italiano" },
  { code: "ro", name: "罗马尼亚语", nameEn: "Romanian", native: "Română" },
  { code: "ca", name: "加泰罗尼亚语", nameEn: "Catalan", native: "Català" },
  { code: "gl", name: "加利西亚语", nameEn: "Galician", native: "Galego" },

  // 欧洲 - 斯拉夫语族
  { code: "ru", name: "俄语", nameEn: "Russian", native: "Русский" },
  { code: "uk", name: "乌克兰语", nameEn: "Ukrainian", native: "Українська" },
  { code: "pl", name: "波兰语", nameEn: "Polish", native: "Polski" },
  { code: "cs", name: "捷克语", nameEn: "Czech", native: "Čeština" },
  { code: "sk", name: "斯洛伐克语", nameEn: "Slovak", native: "Slovenčina" },
  { code: "bg", name: "保加利亚语", nameEn: "Bulgarian", native: "Български" },
  { code: "sr", name: "塞尔维亚语", nameEn: "Serbian", native: "Српски" },
  { code: "hr", name: "克罗地亚语", nameEn: "Croatian", native: "Hrvatski" },
  { code: "sl", name: "斯洛文尼亚语", nameEn: "Slovenian", native: "Slovenščina" },
  { code: "mk", name: "马其顿语", nameEn: "Macedonian", native: "Македонски" },

  // 欧洲 - 其他
  { code: "el", name: "希腊语", nameEn: "Greek", native: "Ελληνικά" },
  { code: "hu", name: "匈牙利语", nameEn: "Hungarian", native: "Magyar" },
  { code: "fi", name: "芬兰语", nameEn: "Finnish", native: "Suomi" },
  { code: "et", name: "爱沙尼亚语", nameEn: "Estonian", native: "Eesti" },
  { code: "lv", name: "拉脱维亚语", nameEn: "Latvian", native: "Latviešu" },
  { code: "lt", name: "立陶宛语", nameEn: "Lithuanian", native: "Lietuvių" },
  { code: "ga", name: "爱尔兰语", nameEn: "Irish", native: "Gaeilge" },
  { code: "cy", name: "威尔士语", nameEn: "Welsh", native: "Cymraeg" },
  { code: "sq", name: "阿尔巴尼亚语", nameEn: "Albanian", native: "Shqip" },
  { code: "bs", name: "波斯尼亚语", nameEn: "Bosnian", native: "Bosanski" },
  { code: "mt", name: "马耳他语", nameEn: "Maltese", native: "Malti" },

  // 非洲
  { code: "sw", name: "斯瓦希里语", nameEn: "Swahili", native: "Kiswahili" },
  { code: "am", name: "阿姆哈拉语", nameEn: "Amharic", native: "አማርኛ" },
  { code: "yo", name: "约鲁巴语", nameEn: "Yoruba", native: "Yorùbá" },
  { code: "ig", name: "伊博语", nameEn: "Igbo", native: "Igbo" },
  { code: "ha", name: "豪萨语", nameEn: "Hausa", native: "Hausa" },
  { code: "zu", name: "祖鲁语", nameEn: "Zulu", native: "isiZulu" },
  { code: "xh", name: "科萨语", nameEn: "Xhosa", native: "isiXhosa" },
  { code: "sn", name: "绍纳语", nameEn: "Shona", native: "chiShona" },

  // 中亚/突厥
  { code: "kk", name: "哈萨克语", nameEn: "Kazakh", native: "Қазақша" },
  { code: "uz", name: "乌兹别克语", nameEn: "Uzbek", native: "Oʻzbekcha" },
  { code: "ky", name: "吉尔吉斯语", nameEn: "Kyrgyz", native: "Кыргызча" },
  { code: "tk", name: "土库曼语", nameEn: "Turkmen", native: "Türkmençe" },
  { code: "az", name: "阿塞拜疆语", nameEn: "Azerbaijani", native: "Azərbaycanca" },
  { code: "tt", name: "鞑靼语", nameEn: "Tatar", native: "Татарча" },
  { code: "mn", name: "蒙古语", nameEn: "Mongolian", native: "Монгол" },

  // 其他
  { code: "la", name: "拉丁语", nameEn: "Latin", native: "Latina" },
  { code: "eo", name: "世界语", nameEn: "Esperanto", native: "Esperanto" },
  { code: "yi", name: "意第绪语", nameEn: "Yiddish", native: "ייִדיש" },
  { code: "hy", name: "亚美尼亚语", nameEn: "Armenian", native: "Հայերեն" },
  { code: "ka", name: "格鲁吉亚语", nameEn: "Georgian", native: "ქართული" },
];

/**
 * 根据代码获取语言
 */
export function getLanguageByCode(code: string): LanguageOption | undefined {
  return WORLD_LANGUAGES.find((l) => l.code === code);
}

/**
 * 搜索语言（支持中文名、英文名、本地名、代码）
 */
export function searchLanguages(query: string): LanguageOption[] {
  if (!query) return WORLD_LANGUAGES;

  const q = query.toLowerCase();
  return WORLD_LANGUAGES.filter(
    (l) =>
      l.code.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.nameEn.toLowerCase().includes(q) ||
      (l.native && l.native.toLowerCase().includes(q))
  );
}

/**
 * 获取语言显示名称
 */
export function getLanguageDisplayName(code: string): string {
  const lang = getLanguageByCode(code);
  if (lang) {
    return `${lang.name} (${lang.nameEn})`;
  }
  return code;
}

/**
 * 获取常用语言（用于默认显示）
 */
export const POPULAR_LANGUAGES = [
  "zh", "en", "ja", "ko", "es", "fr", "de", "ru", "ar", "pt", "it", "hi", "th", "vi"
];

export function getPopularLanguages(): LanguageOption[] {
  return POPULAR_LANGUAGES
    .map((code) => WORLD_LANGUAGES.find((l) => l.code === code))
    .filter(Boolean) as LanguageOption[];
}
