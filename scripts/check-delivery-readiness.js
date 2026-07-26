import { readFile } from "node:fs/promises";
import { validateEvidence } from "../lib/validate-evidence.js";

const inputDefinitions = [
  { name: "evidence", format: "json" },
  { name: "meta", format: "json" },
  { name: "csv", format: "text" },
  { name: "index", format: "json", optional: true },
];

const inputNames = new Set(inputDefinitions.map(({ name }) => name));

function parseArguments(arguments_) {
  const diagnostics = [];
  const inputPaths = new Map();
  const seenInputs = new Set();

  for (let index = 0; index < arguments_.length; index += 1) {
    const option = arguments_[index];
    const name = option.startsWith("--") ? option.slice(2) : undefined;

    if (name === undefined || !inputNames.has(name)) {
      diagnostics.push(`arguments: 未知参数：${option}`);
      if (arguments_[index + 1] && !arguments_[index + 1].startsWith("--")) {
        index += 1;
      }
      continue;
    }

    seenInputs.add(name);
    const inputPath = arguments_[index + 1];
    if (inputPath === undefined || inputPath.startsWith("--")) {
      diagnostics.push(`arguments: 参数缺少文件路径：${option}`);
      continue;
    }

    inputPaths.set(name, inputPath);
    index += 1;
  }

  return { diagnostics, inputPaths, seenInputs };
}

const parsedArguments = parseArguments(process.argv.slice(2));

async function inspectInput(definition) {
  const inputPath = parsedArguments.inputPaths.get(definition.name);
  if (inputPath === undefined) {
    if (parsedArguments.seenInputs.has(definition.name)) {
      return {};
    }
    return {
      diagnostic: definition.optional
        ? undefined
        : `${definition.name}: 缺少必需参数：--${definition.name}`,
    };
  }

  let content;
  try {
    content = await readFile(inputPath, "utf8");
  } catch {
    return {
      diagnostic: `${definition.name}: 无法读取输入文件：${inputPath}`,
    };
  }

  if (definition.format === "json") {
    try {
      return { data: JSON.parse(content) };
    } catch {
      return {
        diagnostic: `${definition.name}: JSON 格式无效：${inputPath}`,
      };
    }
  }

  return { data: content };
}

const inspectedInputs = await Promise.all(inputDefinitions.map(inspectInput));
const diagnostics = [...parsedArguments.diagnostics];

for (const [index, inspectedInput] of inspectedInputs.entries()) {
  if (inspectedInput.diagnostic !== undefined) {
    diagnostics.push(inspectedInput.diagnostic);
  } else if (
    inputDefinitions[index].name === "evidence" &&
    inspectedInput.data !== undefined
  ) {
    diagnostics.push(...validateEvidence(inspectedInput.data));
  }
}

if (diagnostics.length > 0) {
  console.error(diagnostics.join("\n"));
  process.exitCode = 1;
} else {
  console.log("交付就绪检查通过。");
}
