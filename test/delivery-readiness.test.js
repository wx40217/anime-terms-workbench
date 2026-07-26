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

test("最小合规交付输入通过统一检查命令", () => {
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
