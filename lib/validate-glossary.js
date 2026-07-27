const expectedHeader = ["source", "target", "tgt_lng"];

function syntaxDiagnostic(line, message) {
  return `csv.line[${line}]: CSV 格式无效：${message}`;
}

function parseCsv(content) {
  const rows = [];
  let fields = [];
  let field = "";
  let state = "unquoted";
  let line = 1;
  let rowLine = 1;
  let justEndedRow = false;

  function finishField() {
    fields.push(field);
    field = "";
  }

  function finishRow() {
    finishField();
    rows.push({ fields });
    fields = [];
  }

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (state === "quoted") {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          state = "after-quote";
        }
      } else if (character === "\r" || character === "\n") {
        if (character === "\r" && content[index + 1] === "\n") {
          field += "\r\n";
          index += 1;
        } else {
          field += character;
        }
        line += 1;
      } else {
        field += character;
      }
      justEndedRow = false;
      continue;
    }

    if (state === "after-quote") {
      if (character === ",") {
        finishField();
        state = "unquoted";
        justEndedRow = false;
        continue;
      }
      if (character !== "\r" && character !== "\n") {
        return {
          diagnostics: [
            syntaxDiagnostic(line, "结束引号后只能出现分隔符或换行"),
          ],
          rows: [],
        };
      }
    } else if (character === '"' && field === "") {
      state = "quoted";
      justEndedRow = false;
      continue;
    } else if (character === '"') {
      return {
        diagnostics: [syntaxDiagnostic(line, "未加引号的字段不能包含双引号")],
        rows: [],
      };
    } else if (character === ",") {
      finishField();
      justEndedRow = false;
      continue;
    } else if (character !== "\r" && character !== "\n") {
      field += character;
      justEndedRow = false;
      continue;
    }

    finishRow();
    state = "unquoted";
    if (character === "\r" && content[index + 1] === "\n") {
      index += 1;
    }
    line += 1;
    rowLine = line;
    justEndedRow = true;
  }

  if (state === "quoted") {
    return {
      diagnostics: [syntaxDiagnostic(rowLine, "引用字段缺少结束引号")],
      rows: [],
    };
  }

  if (!justEndedRow) {
    finishRow();
  }

  return { diagnostics: [], rows };
}

function rowLocation(index, source) {
  const sourceSuffix =
    typeof source === "string" && source.length > 0 ? ` (${source})` : "";
  return `csv.rows[${index}]${sourceSuffix}`;
}

export function validateGlossaryCsv(content) {
  const parsed = parseCsv(content);
  if (parsed.diagnostics.length > 0) {
    return { ...parsed, comparable: false };
  }

  const diagnostics = [];
  const [header, ...dataRows] = parsed.rows;
  const headerFields = header?.fields ?? [];
  if (headerFields[0]?.startsWith("\uFEFF")) {
    headerFields[0] = headerFields[0].slice(1);
  }
  const headerIsInvalid =
    headerFields.length !== expectedHeader.length ||
    expectedHeader.some((field, index) => headerFields[index] !== field);
  if (headerIsInvalid) {
    diagnostics.push(
      `csv.header: 表头必须且只能是 ${expectedHeader.join(",")}`,
    );
  }

  const rows = [];
  for (const [offset, row] of dataRows.entries()) {
    const index = offset + 1;
    const [source, target, targetLanguage] = row.fields;
    const location = rowLocation(index, source);

    if (row.fields.length !== 3) {
      diagnostics.push(`${location}: 必须且只能包含 3 列`);
      continue;
    }
    if (source.length === 0) {
      diagnostics.push(`${location}: source 必须是非空字符串`);
    }
    if (target.length === 0) {
      diagnostics.push(`${location}: target 必须是非空字符串`);
    }
    if (targetLanguage !== "zh-CN") {
      diagnostics.push(`${location}: tgt_lng 必须是 zh-CN`);
    }
    rows.push({
      source,
      target,
      row: index,
      hasComparablePair: source.length > 0 && target.length > 0,
    });
  }

  return { comparable: !headerIsInvalid, diagnostics, rows };
}

function evidenceLocation(record, index) {
  const sourceSuffix =
    typeof record.source === "string" && record.source.length > 0
      ? ` (${record.source})`
      : "";
  return `evidence.records[${index}]${sourceSuffix}`;
}

export function validateGlossaryCsvUniqueness(csvRows) {
  const diagnostics = [];
  const firstCsvRowBySource = new Map();
  for (const row of csvRows) {
    if (row.source.length === 0) {
      continue;
    }
    const existing = firstCsvRowBySource.get(row.source);
    if (existing !== undefined) {
      const relationship =
        existing.target === row.target
          ? `source 与第 ${existing.row} 行重复`
          : `source 与第 ${existing.row} 行的 target 冲突`;
      diagnostics.push(
        `${rowLocation(row.row, row.source)}: ${relationship}`,
      );
      continue;
    }
    firstCsvRowBySource.set(row.source, row);
  }

  return diagnostics;
}

export function validateEvidenceCsvConsistency(evidence, csvRows) {
  const diagnostics = [];
  const acceptedBySource = new Map();
  const candidateSources = new Set();

  for (const [index, record] of evidence.records.entries()) {
    if (record.status === "candidate") {
      candidateSources.add(record.source);
      continue;
    }
    if (record.status !== "accepted") {
      continue;
    }

    const existing = acceptedBySource.get(record.source);
    if (existing !== undefined) {
      diagnostics.push(
        `${evidenceLocation(record, index)}: 已接受旁证记录与 evidence.records[${existing.index}] 重复`,
      );
      continue;
    }
    acceptedBySource.set(record.source, {
      index,
      record,
    });
  }

  const firstCsvRowBySource = new Map();
  for (const row of csvRows) {
    if (row.source.length > 0 && !firstCsvRowBySource.has(row.source)) {
      firstCsvRowBySource.set(row.source, row);
    }
  }

  for (const row of firstCsvRowBySource.values()) {
    if (!row.hasComparablePair) {
      continue;
    }
    const accepted = acceptedBySource.get(row.source);
    if (accepted === undefined) {
      const message = candidateSources.has(row.source)
        ? "候选术语不能进入发布 CSV"
        : "没有对应的已接受旁证记录";
      diagnostics.push(`${rowLocation(row.row, row.source)}: ${message}`);
      continue;
    }
    if (row.target !== accepted.record.target) {
      diagnostics.push(
        `${rowLocation(row.row, row.source)}: target 与已接受译法不一致，应为 ${accepted.record.target}`,
      );
    }
  }

  for (const [source, accepted] of acceptedBySource) {
    if (!firstCsvRowBySource.has(source)) {
      diagnostics.push(
        `${evidenceLocation(accepted.record, accepted.index)}: 已接受术语未出现在发布 CSV`,
      );
    }
  }

  return diagnostics;
}
