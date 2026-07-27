import path from "node:path";

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const globalMatchRules = new Set(["*", "*://*/*"]);

export function validateAnimeMeta(meta, metaPath) {
  const diagnostics = [];

  if (path.basename(metaPath) !== "anime.json") {
    diagnostics.push("meta.file: 文件名必须是 anime.json");
  }
  if (!isObject(meta)) {
    diagnostics.push("meta: 候选元数据必须是对象");
    return diagnostics;
  }
  if (meta.id !== "anime") {
    diagnostics.push("meta.id: 必须是 anime");
  }
  if (meta.glossary !== "anime") {
    diagnostics.push("meta.glossary: 必须引用 anime");
  }

  if (!Array.isArray(meta.langs)) {
    diagnostics.push("meta.langs: 必须是数组");
  } else {
    let simplifiedChineseCount = 0;
    for (const [index, language] of meta.langs.entries()) {
      if (language === "zh-CN") {
        simplifiedChineseCount += 1;
      } else if (language === "auto") {
        diagnostics.push(
          `meta.langs[${index}] (auto): 首版不允许使用 auto`,
        );
      } else {
        const label =
          typeof language === "string" && language.length > 0
            ? ` (${language})`
            : "";
        diagnostics.push(
          `meta.langs[${index}]${label}: 首版不支持 zh-CN 以外的目标语言`,
        );
      }
    }
    if (simplifiedChineseCount === 0) {
      diagnostics.push("meta.langs: 必须包含 zh-CN");
    } else if (simplifiedChineseCount > 1) {
      diagnostics.push("meta.langs: zh-CN 只能出现一次");
    }
  }

  const localizedMeta =
    isObject(meta.i18ns) && isObject(meta.i18ns["zh-CN"])
      ? meta.i18ns["zh-CN"]
      : {};
  if (!isNonEmptyString(localizedMeta.name)) {
    diagnostics.push("meta.i18ns.zh-CN.name: 必须是非空字符串");
  }
  if (!isNonEmptyString(localizedMeta.description)) {
    diagnostics.push("meta.i18ns.zh-CN.description: 必须是非空字符串");
  }

  let restrictedMatchCount = 0;
  if (Array.isArray(meta.matches)) {
    for (const [index, matchRule] of meta.matches.entries()) {
      if (!isNonEmptyString(matchRule)) {
        diagnostics.push(`meta.matches[${index}]: 必须是非空字符串`);
      } else if (globalMatchRules.has(matchRule.trim())) {
        diagnostics.push(
          `meta.matches[${index}] (${matchRule}): 首版不允许使用全局匹配`,
        );
      } else {
        restrictedMatchCount += 1;
      }
    }
  }
  if (restrictedMatchCount < 2 || restrictedMatchCount > 3) {
    diagnostics.push("meta.matches: 必须包含 2 至 3 个受限站点匹配规则");
  }

  return diagnostics;
}

export function validatePrivateAnimeIndex(index) {
  if (!Array.isArray(index)) {
    return ["index: 公共索引必须是数组"];
  }

  const diagnostics = [];
  for (const [entryIndex, glossaryId] of index.entries()) {
    if (glossaryId === "anime") {
      diagnostics.push(
        `index[${entryIndex}] (anime): 不公开试点不得进入公共索引`,
      );
    }
  }
  return diagnostics;
}
