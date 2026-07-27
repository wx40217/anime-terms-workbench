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
    path.join(validFixture, "anime.json"),
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
    path.join(validFixture, "anime.json"),
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
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "交付就绪检查通过。\n");
  assert.equal(result.stderr, "");
});

test("anime 候选元数据必须统一文件身份、标识、语言和本地化信息", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(invalidFixture, "meta-identity", "not-anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "meta.file: 文件名必须是 anime.json",
    "meta.id: 必须是 anime",
    "meta.glossary: 必须引用 anime",
    "meta.langs[0] (auto): 首版不允许使用 auto",
    "meta.langs[1] (zh-TW): 首版不支持 zh-CN 以外的目标语言",
    "meta.langs: 必须包含 zh-CN",
    "meta.i18ns.zh-CN.name: 必须是非空字符串",
    "meta.i18ns.zh-CN.description: 必须是非空字符串",
  ]);
});

test("anime 试点元数据必须声明 2 至 3 个受限站点规则", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(invalidFixture, "meta-matches-missing", "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "meta.matches: 必须包含 2 至 3 个受限站点匹配规则\n",
  );
});

test("anime 试点元数据不能用全局匹配凑足候选站点规则", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(invalidFixture, "meta-matches-global", "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "meta.matches[0] (*): 首版不允许使用全局匹配",
    "meta.matches[1] (*://*/*): 首版不允许使用全局匹配",
    "meta.matches: 必须包含 2 至 3 个受限站点匹配规则",
  ]);
});

test("元数据错误和 anime 提前进入公共索引会一次确定性报告", () => {
  const arguments_ = [
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(invalidFixture, "meta-identity", "not-anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
    "--index",
    path.join(invalidFixture, "index-public.json"),
  ];
  const result = runDeliveryReadiness(arguments_);
  const repeatedResult = runDeliveryReadiness(arguments_);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "meta.file: 文件名必须是 anime.json",
    "meta.id: 必须是 anime",
    "meta.glossary: 必须引用 anime",
    "meta.langs[0] (auto): 首版不允许使用 auto",
    "meta.langs[1] (zh-TW): 首版不支持 zh-CN 以外的目标语言",
    "meta.langs: 必须包含 zh-CN",
    "meta.i18ns.zh-CN.name: 必须是非空字符串",
    "meta.i18ns.zh-CN.description: 必须是非空字符串",
    "index[0] (anime): 不公开试点不得进入公共索引",
  ]);
  assert.equal(repeatedResult.status, result.status);
  assert.equal(repeatedResult.stdout, result.stdout);
  assert.equal(repeatedResult.stderr, result.stderr);
});

test("发布 CSV 必须使用固定表头、三列非空字段和 zh-CN 语言代码", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(invalidFixture, "glossary-structure.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "csv.header: 表头必须且只能是 source,target,tgt_lng",
    "csv.rows[1]: source 必须是非空字符串",
    "csv.rows[2] (源词): target 必须是非空字符串",
    "csv.rows[2] (源词): tgt_lng 必须是 zh-CN",
    "csv.rows[3] (短行): 必须且只能包含 3 列",
  ]);
});

test("发布 CSV 拒绝未闭合的引用字段", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(invalidFixture, "glossary-syntax.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "csv.line[2]: CSV 格式无效：引用字段缺少结束引号\n",
  );
});

test("发布 CSV 正确解析带分隔符和转义双引号的合法字段", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence-quoted.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(validFixture, "glossary-quoted.csv"),
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "交付就绪检查通过。\n");
  assert.equal(result.stderr, "");
});

test("发布 CSV 定位重复 source 和互相冲突的 target", () => {
  const arguments_ = [
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(invalidFixture, "glossary-duplicates.csv"),
  ];
  const result = runDeliveryReadiness(arguments_);
  const repeatedResult = runDeliveryReadiness(arguments_);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "csv.rows[2] (テレビアニメ): source 与第 1 行重复",
    "csv.rows[3] (テレビアニメ): source 与第 1 行的 target 冲突",
  ]);
  assert.equal(repeatedResult.stderr, result.stderr);
});

test("结构错误不会掩盖仍可定位的重复和双向一致性错误", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(invalidFixture, "glossary-aggregate.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "csv.rows[1] (劇場先行上映): tgt_lng 必须是 zh-CN",
    "csv.rows[2] (劇場先行上映): tgt_lng 必须是 zh-CN",
    "csv.rows[3] (劇場先行上映): 必须且只能包含 3 列",
    "csv.rows[2] (劇場先行上映): source 与第 1 行重复",
    "csv.rows[3] (劇場先行上映): source 与第 1 行重复",
    "csv.rows[1] (劇場先行上映): 候选术语不能进入发布 CSV",
    "evidence.records[0] (テレビアニメ): 已接受术语未出现在发布 CSV",
  ]);
});

test("旁证记录中的重复 accepted source 会被定位", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(invalidFixture, "evidence-duplicate-accepted.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "evidence.records[1] (テレビアニメ): 已接受旁证记录与 evidence.records[0] 重复\n",
  );
});

test("发布 CSV 拒绝候选泄漏、无旁证行和被改动的定稿译法", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(invalidFixture, "glossary-mapping.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "csv.rows[1] (劇場先行上映): 候选术语不能进入发布 CSV",
    "csv.rows[2] (未知术语): 没有对应的已接受旁证记录",
    "csv.rows[3] (テレビアニメ): target 与已接受译法不一致，应为 电视动画（TV版）",
  ]);
});

test("每条已接受旁证记录都必须进入发布 CSV", () => {
  const result = runDeliveryReadiness([
    "--evidence",
    path.join(validFixture, "evidence.json"),
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(invalidFixture, "glossary-missing.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    "evidence.records[0] (テレビアニメ): 已接受术语未出现在发布 CSV\n",
  );
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
    path.join(validFixture, "anime.json"),
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
    path.join(validFixture, "anime.json"),
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
    path.join(validFixture, "anime.json"),
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
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (テレビアニメ): 竞争译法备选项[0]必须是非空字符串",
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
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (テレビアニメ): 定稿译法必须是单一且可直接替换的表达",
    "evidence.records[1] (劇場アニメ): 定稿译法必须是单一且可直接替换的表达",
    "evidence.records[2] (作画監督): 定稿译法必须是单一且可直接替换的表达",
    "evidence.records[3] (撮影監督): 定稿译法必须是单一且可直接替换的表达",
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
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (テレビアニメ).japaneseEvidence[0]: Search-Result 只能声明为 discovery 来源",
    "evidence.records[0] (テレビアニメ): 日文含义证据必须至少包含一个定稿来源",
  ]);
});

test("候选术语允许省略未完成字段但拒绝已填写的畸形字段", () => {
  const evidencePath = path.join(
    invalidFixture,
    "evidence-candidate-fields.json",
  );
  const result = runDeliveryReadiness([
    "--evidence",
    evidencePath,
    "--meta",
    path.join(validFixture, "anime.json"),
    "--csv",
    path.join(validFixture, "glossary.csv"),
  ]);

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.deepEqual(result.stderr.trimEnd().split("\n"), [
    "evidence.records[0] (作画): 定稿译法必须是单一且可直接替换的表达",
    "evidence.records[0] (作画): 取舍理由必须是非空字符串",
    "evidence.records[0] (作画): 竞争译法审查的 required 必须是布尔值",
    "evidence.records[0] (作画): 竞争译法备选列表必须是数组",
    "evidence.records[0] (作画): 非动漫含义审查必须是非空字符串",
    "evidence.records[0] (作画): 子串重叠审查必须是非空字符串",
    "evidence.records[0] (作画): 负面样例审查必须是数组",
    "evidence.records[0] (作画): 复查日期必须是有效的 YYYY-MM-DD 日期",
  ]);
});
