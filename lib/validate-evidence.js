function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const discoveryOnlySourceTypes = new Set([
  "community",
  "machine-translation",
  "search-result",
]);

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value;
}

function hasFinalEvidence(evidenceItems) {
  return Array.isArray(evidenceItems) &&
    evidenceItems.some((item) =>
      isObject(item) &&
      item.role === "final" &&
      !discoveryOnlySourceTypes.has(item.sourceType)
    );
}

function hasUnsafeTargetMarkers(target) {
  return /[\r\n/／|｜()（）[\]【】]/.test(target) ||
    /(?:TODO|TBD|待确认|待定|暂定|或译|又称|也称|\?)/i.test(target);
}

function validateEvidenceItems(evidenceItems, location) {
  if (evidenceItems === undefined) {
    return [];
  }

  if (!Array.isArray(evidenceItems)) {
    return [`${location}: 必须是数组`];
  }

  const diagnostics = [];

  for (const [index, item] of evidenceItems.entries()) {
    const itemLocation = `${location}[${index}]`;
    if (!isObject(item)) {
      diagnostics.push(`${itemLocation}: 证据项必须是对象`);
      continue;
    }

    if (!isNonEmptyString(item.title)) {
      diagnostics.push(`${itemLocation}: 标题必须是非空字符串`);
    }
    if (!isNonEmptyString(item.publisher)) {
      diagnostics.push(`${itemLocation}: 发布机构必须是非空字符串`);
    }
    if (!isNonEmptyString(item.sourceType)) {
      diagnostics.push(`${itemLocation}: 来源类型必须是非空字符串`);
    }
    if (!isNonEmptyString(item.reference)) {
      diagnostics.push(`${itemLocation}: 链接或书目引用必须是非空字符串`);
    }
    if (!isValidDate(item.checkedAt)) {
      diagnostics.push(
        `${itemLocation}: 核对日期必须是有效的 YYYY-MM-DD 日期`,
      );
    }
    if (!isNonEmptyString(item.summary)) {
      diagnostics.push(`${itemLocation}: 证据摘要必须是非空字符串`);
    }
    if (item.role !== "final" && item.role !== "discovery") {
      diagnostics.push(`${itemLocation}: 来源角色必须是 final 或 discovery`);
    } else if (
      item.role === "final" &&
      discoveryOnlySourceTypes.has(item.sourceType)
    ) {
      diagnostics.push(
        `${itemLocation}: ${item.sourceType} 只能声明为 discovery 来源`,
      );
    }
  }

  return diagnostics;
}

function validateAcceptedRecord(record, location) {
  const diagnostics = [];

  if (!isNonEmptyString(record.target)) {
    diagnostics.push(`${location}: 定稿译法必须是非空字符串`);
  } else if (hasUnsafeTargetMarkers(record.target)) {
    diagnostics.push(
      `${location}: 定稿译法必须是单一且可直接替换的表达`,
    );
  }

  if (!hasFinalEvidence(record.japaneseEvidence)) {
    diagnostics.push(
      `${location}: 日文含义证据必须至少包含一个定稿来源`,
    );
  }

  if (!hasFinalEvidence(record.chineseEvidence)) {
    diagnostics.push(
      `${location}: 简体中文用法证据必须至少包含一个定稿来源`,
    );
  }

  if (!isNonEmptyString(record.rationale)) {
    diagnostics.push(`${location}: 取舍理由必须是非空字符串`);
  }

  if (!isObject(record.competitionReview)) {
    diagnostics.push(`${location}: 竞争译法审查必须是对象`);
  } else {
    const { alternatives, required } = record.competitionReview;
    if (typeof required !== "boolean") {
      diagnostics.push(`${location}: 竞争译法审查的 required 必须是布尔值`);
    }
    if (!Array.isArray(alternatives)) {
      diagnostics.push(`${location}: 竞争译法备选列表必须是数组`);
    } else if (
      required &&
      !alternatives.some((alternative) => isNonEmptyString(alternative))
    ) {
      diagnostics.push(
        `${location}: 存在竞争译法时必须记录至少一个备选译法`,
      );
    }

    if (required) {
      const finalChinesePublishers = new Set(
        Array.isArray(record.chineseEvidence)
          ? record.chineseEvidence
            .filter((item) =>
              isObject(item) &&
              item.role === "final" &&
              isNonEmptyString(item.publisher)
            )
            .map((item) => item.publisher.trim())
          : [],
      );
      if (finalChinesePublishers.size < 2) {
        diagnostics.push(
          `${location}: 存在竞争译法时必须有至少两个不同发布机构的中文定稿来源`,
        );
      }
    }
  }

  if (!isObject(record.mismatchRiskReview)) {
    diagnostics.push(`${location}: 误匹配审查必须是对象`);
  } else {
    if (!isNonEmptyString(record.mismatchRiskReview.nonAnimeMeanings)) {
      diagnostics.push(`${location}: 非动漫含义审查必须是非空字符串`);
    }
    if (!isNonEmptyString(record.mismatchRiskReview.substringOverlaps)) {
      diagnostics.push(`${location}: 子串重叠审查必须是非空字符串`);
    }
    if (!Array.isArray(record.mismatchRiskReview.negativeExamples)) {
      diagnostics.push(`${location}: 负面样例审查必须是数组`);
    }
  }

  if (!isValidDate(record.reviewedAt)) {
    diagnostics.push(`${location}: 复查日期必须是有效的 YYYY-MM-DD 日期`);
  }

  return diagnostics;
}

export function validateEvidence(evidence) {
  if (!isObject(evidence)) {
    return ["evidence: 旁证数据必须是对象"];
  }

  if (!Array.isArray(evidence.records)) {
    return ["evidence.records: 必须是数组"];
  }

  const diagnostics = [];

  for (const [index, record] of evidence.records.entries()) {
    const location = `evidence.records[${index}]`;
    if (!isObject(record)) {
      diagnostics.push(`${location}: 旁证记录必须是对象`);
      continue;
    }

    if (!isNonEmptyString(record.source)) {
      diagnostics.push(`${location}: 字面源词必须是非空字符串`);
    }

    if (record.status !== "candidate" && record.status !== "accepted") {
      diagnostics.push(`${location}: 准入状态必须是 candidate 或 accepted`);
    }

    const identifiedLocation = isNonEmptyString(record.source)
      ? `${location} (${record.source.trim()})`
      : location;
    diagnostics.push(
      ...validateEvidenceItems(
        record.japaneseEvidence,
        `${identifiedLocation}.japaneseEvidence`,
      ),
      ...validateEvidenceItems(
        record.chineseEvidence,
        `${identifiedLocation}.chineseEvidence`,
      ),
    );

    if (record.status === "accepted") {
      diagnostics.push(...validateAcceptedRecord(record, identifiedLocation));
    }
  }

  return diagnostics;
}
