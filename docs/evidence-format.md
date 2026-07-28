# 旁证记录格式

旁证数据是一个 JSON 对象，使用 `records` 数组逐条保存候选术语和已接受术语。`glossary` 用于声明数据所属术语库；其具体取值由交付边界检查负责。

## 记录字段

| 字段 | candidate | accepted | 含义 |
| --- | --- | --- | --- |
| `source` | 必需 | 必需 | 正式日文页面中实际出现的字面源词 |
| `status` | `candidate` | `accepted` | 准入状态 |
| `target` | 可省略 | 必需 | 单一、可直接替换的简体中文定稿译法 |
| `japaneseEvidence` | 可省略 | 必需 | 支持日文行业含义的证据项数组 |
| `chineseEvidence` | 可省略 | 必需 | 支持简体中文用法的证据项数组 |
| `rationale` | 可省略 | 必需 | 定稿译法的取舍理由 |
| `competitionReview` | 可省略 | 必需 | 竞争译法审查 |
| `mismatchRiskReview` | 可省略 | 必需 | 误匹配审查 |
| `reviewedAt` | 可省略 | 必需 | `YYYY-MM-DD` 格式的有效复查日期 |

候选术语允许缺少尚未完成的字段，但所有已经填写的字段仍须符合本格式。将状态改为 `accepted` 会启用全部准入检查，不能绕过缺失工作。

## 证据项

每个日文或简体中文证据项包含：

- `title`：来源标题。
- `publisher`：发布机构。
- `sourceType`：研究者声明的来源类型。
- `reference`：链接或书目引用。
- `checkedAt`：`YYYY-MM-DD` 格式的有效核对日期。
- `summary`：该来源具体支持何种判断。
- `role`：`final` 或 `discovery`。

已接受术语的两侧证据都必须至少包含一个 `final` 来源。`community`、`search-result` 和 `machine-translation` 是明确的发现线索类型，只能声明为 `discovery`。除此之外，检查器不判断来源是否权威，也不判断证据摘要在语义上是否正确；这些仍是人工研究结论。

## 竞争译法审查

`competitionReview` 包含：

- `required`：是否存在需要比较的竞争译法。
- `alternatives`：备选译法字符串数组。

`required` 为 `true` 时，必须记录至少一个备选译法，并且简体中文证据中至少有两个不同发布机构的 `final` 来源。证据摘要和取舍理由应说明这些来源分别支持的判断。

## 误匹配审查

`mismatchRiskReview` 包含：

- `nonAnimeMeanings`：非动漫含义检查结论。
- `substringOverlaps`：与其他术语的子串重叠检查结论。
- `negativeExamples`：负面样例审查数组。

前两个结论必须是非空字符串。负面样例的具体内容由后续试点研究记录；本阶段验证其结构，不自动判断页面替换是否安全。

## 定稿译法限制

定稿译法不得为空，也不得包含明显的占位符、并列分隔符、解释性括注或换行。译法准确性、通行程度和自然度仍由研究者根据双向证据判断。

旁证与发布 CSV 的精确双向一致性属于独立的[交付数据检查](delivery-data-contract.md)；候选术语是否泄漏到 CSV 不由本格式检查代替。
