# Anime Terms Workbench

用于策展日文到简体中文动漫翻译术语的本地工作台。这里保存设计、逐条旁证、采集与审查工具以及试点过程；最终交付仍通过独立的 `terms` 仓库提交。

## Repository Boundary

- **工作台仓库**：`/Users/zhuleiye02/Git/anime-terms-workbench`
  - `CONTEXT.md`
  - `docs/adr/`
  - `docs/agents/`
  - `evidence/anime_zh-CN.json`
  - `reviews/anime-private-pilot.json`
  - 采集、校验与页面审查记录和工具
- **交付仓库**：`/Users/zhuleiye02/Git/terms`
  - `meta/anime.json`
  - `glossaries/anime_zh-CN.csv`
  - 正式发布时更新 `meta/index.json`
  - 仅在适合整个仓库时接收通用校验工具

原始网页、抓取缓存、临时产物和凭证不得提交。工作台通过 `wx40217/anime-terms-workbench` 远端保留实现与设计历史。

## Delivery Workflow

1. 在工作台中自动发现候选术语，补齐双向证据、独立复核和真实页面审查。
2. 收敛出 80 至 120 条正式首版术语及 5 至 10 个站点作用域，并通过全部发布门槛。
3. 在 `terms` 仓库同步最新 `main`，创建短期交付分支。
4. 将已接受术语导出为三列 CSV，同时生成元数据并更新公共索引。
5. 对发布数据与工作台旁证执行双向一致性和交付就绪检查。
6. 向 `immersive-translate/terms` 提交包含完整发布内容的上游 PR；上游审核是唯一人工发布批准。
7. PR 合并后删除短期交付分支，继续在工作台维护下一批候选。

不公开试点分支和 fork 内部 PR 只验证交付形状，审查结束后关闭且不合入主分支。

## Current Status

领域边界、旁证结构和不公开试点已经完成，15 条试点术语作为种子候选保留，不构成正式发布批准。正式首版默认在首个完整通过门槛的 80 条处停止，每类至少 5 条，并收敛到 5 至 10 个站点作用域；每条术语都必须具有跨作品日文用例、两个独立人工编辑中文来源、独立策展复核和白名单真实页面覆盖。下一阶段是将这些决策转成可执行规格，再实现自动策展与确定性交付流程。

## Delivery Readiness

统一交付就绪入口同时装载旁证、候选元数据、发布 CSV 和可选的公共索引状态：

```sh
npm run check:delivery -- \
  --evidence <evidence-json> \
  --meta <meta-json> \
  --csv <glossary-csv> \
  [--index <public-index-json>]
```

命令会聚合所有可定位的输入错误，发现阻塞问题时返回非零状态，并对相同输入保持确定性诊断。当前阶段检查必需参数、文件可读性、JSON 格式、[旁证记录准入规则](docs/evidence-format.md)、[发布 CSV 与旁证的严格双向一致性](docs/delivery-data-contract.md)，以及[`anime` 不公开试点边界](docs/anime-pilot-boundary.md)。

运行自动测试和静态语法检查：

```sh
npm test
npm run check
```
