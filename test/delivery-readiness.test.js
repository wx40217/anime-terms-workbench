import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const validFixture = path.join(
  repositoryRoot,
  "test",
  "fixtures",
  "delivery-readiness",
  "valid",
);
const invalidFixture = path.join(
  repositoryRoot,
  "test",
  "fixtures",
  "delivery-readiness",
  "invalid",
);

function runDeliveryReadiness(arguments_) {
  return spawnSync(
    "npm",
    ["run", "--silent", "check:delivery", "--", ...arguments_],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
}

test("完整已接受术语和不完整候选术语可以通过统一检查命令", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
    "--index",
    path.join(validFixture, "index.json"),
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "交付就绪检查通过。\n");
  assert.equal(result.stderr, "");
});

test("统一检查命令聚合并定位所有阻塞性输入错误", () => {
  const evidencePath = path.join(invalidFixture, "evidence.json");
  const metaPath = path.join(invalidFixture, "meta.json");
  const csvPath = path.join(invalidFixture, "missing.csv");
  const indexPath = path.join(invalidFixture, "index.json");
  const arguments_ = [
    "--evidence",
    evidencePath,
    "--meta",
    metaPath,
    "--csv",
    csvPath,
    "--index",
    indexPath,
  ];

  const result = runDeliveryReadiness(arguments_);
  const repeatedResult = runDeliveryReadiness(arguments_);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    `evidence: JSON 格式无效：${evidencePath}`,
    `meta: JSON 格式无效：${metaPath}`,
    `csv: 无法读取输入文件：${csvPath}`,
    `index: JSON 格式无效：${indexPath}`,
  ]);
  assert.equal(repeatedResult.status, result.status);
  assert.equal(repeatedResult.stdout, result.stdout);
  assert.equal(repeatedResult.stderr, result.stderr);
});

test("统一检查命令一次报告所有缺失的必需输入", () => {
  const result = runDeliveryReadiness([]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence: 缺少必需参数：--evidence",
    "meta: 缺少必需参数：--meta",
    "csv: 缺少必需参数：--csv",
  ]);
});

test("统一检查命令定位无效的命令行参数", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
    "--unexpected",
    "value",
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "arguments: 参数缺少文件路径：--evidence",
    "arguments: 未知参数：--unexpected",
  ]);
});

test("公共索引输入可以省略", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "交付就绪检查通过。\n");
  assert.equal(result.stderr, "");
});

test("统一检查命令拒绝畸形旁证记录并允许不完整候选术语", () => {
  const evidencePath = path.join(
    invalidFixture,
    "evidence-record-structure.json",
  );
  const result = runDeliveryReadiness([
    "--evidence",
    evidencePath,
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0]: 旁证记录必须是对象",
    "evidence.records[1]: 字面源词必须是非空字符串",
    "evidence.records[1]: 准入状态必须是 candidate 或 accepted",
  ]);
});

test("已接受术语必须满足完整旁证准入条件", () => {
  const evidencePath = path.join(
    invalidFixture,
    "evidence-accepted-admission.json",
  );
  const result = runDeliveryReadiness([
    "--evidence",
    evidencePath,
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (テレビアニメ): 定稿译法必须是非空字符串",
    "evidence.records[0] (テレビアニメ): 日文含义证据必须至少包含一个定稿来源",
    "evidence.records[0] (テレビアニメ): 简体中文用法证据必须至少包含一个定稿来源",
    "evidence.records[0] (テレビアニメ): 取舍理由必须是非空字符串",
    "evidence.records[0] (テレビアニメ): 竞争译法审查必须是对象",
    "evidence.records[0] (テレビアニメ): 误匹配审查必须是对象",
    "evidence.records[0] (テレビアニメ): 复查日期必须是有效的 YYYY-MM-DD 日期",
  ]);
});

test("候选术语中已填写的证据项也必须使用统一结构", () => {
  const evidencePath = path.join(
    invalidFixture,
    "evidence-item-structure.json",
  );
  const result = runDeliveryReadiness([
    "--evidence",
    evidencePath,
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (作画).japaneseEvidence[0]: 标题必须是非空字符串",
    "evidence.records[0] (作画).japaneseEvidence[0]: 发布机构必须是非空字符串",
    "evidence.records[0] (作画).japaneseEvidence[0]: 来源类型必须是非空字符串",
    "evidence.records[0] (作画).japaneseEvidence[0]: 链接或书目引用必须是非空字符串",
    "evidence.records[0] (作画).japaneseEvidence[0]: 核对日期必须是有效的 YYYY-MM-DD 日期",
    "evidence.records[0] (作画).japaneseEvidence[0]: 证据摘要必须是非空字符串",
    "evidence.records[0] (作画).japaneseEvidence[0]: 来源角色必须是 final 或 discovery",
    "evidence.records[0] (作画).chineseEvidence: 必须是数组",
  ]);
});

test("已接受术语不能用形式完整的数据绕过关键准入检查", () => {
  const evidencePath = path.join(
    invalidFixture,
    "evidence-accepted-decisions.json",
  );
  const result = runDeliveryReadiness([
    "--evidence",
    evidencePath,
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (テレビアニメ): 存在竞争译法时必须记录至少一个备选译法",
    "evidence.records[0] (テレビアニメ): 存在竞争译法时必须有至少两个不同发布机构的中文定稿来源",
    "evidence.records[0] (テレビアニメ): 非动漫含义审查必须是非空字符串",
    "evidence.records[0] (テレビアニメ): 子串重叠审查必须是非空字符串",
    "evidence.records[0] (テレビアニメ): 负面样例审查必须是数组",
  ]);
});

test("定稿译法拒绝占位符、并列候选和非固定括注", () => {
  const evidencePath = path.join(
    invalidFixture,
    "evidence-finalized-targets.json",
  );
  const result = runDeliveryReadiness([
    "--evidence",
    evidencePath,
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (テレビアニメ): 定稿译法必须是单一且可直接替换的表达",
    "evidence.records[1] (劇場アニメ): 定稿译法必须是单一且可直接替换的表达",
    "evidence.records[2] (作画監督): 定稿译法必须是单一且可直接替换的表达",
  ]);
});

test("发现线索来源不能伪装成定稿来源", () => {
  const evidencePath = path.join(
    invalidFixture,
    "evidence-discovery-promoted.json",
  );
  const result = runDeliveryReadiness([
    "--evidence",
    evidencePath,
    "--meta",
    path.join(validFixture, "meta.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (テレビアニメ).japaneseEvidence[0]: search-result 只能声明为 discovery 来源",
    "evidence.records[0] (テレビアニメ): 日文含义证据必须至少包含一个定稿来源",
  ]);
});
