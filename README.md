# Anime Terms Workbench

用于策展日文到简体中文动漫翻译术语的本地工作台。这里保存设计、逐条旁证、采集与审查工具以及试点过程；最终交付仍通过独立的 `terms` 仓库提交。

## Repository Boundary

- **工作台仓库**：`/Users/zhuleiye02/Git/anime-terms-workbench`
  - `CONTEXT.md`
  - `docs/adr/`
  - `docs/agents/`
  - `evidence/anime_zh-CN.json`
  - `reviews/anime-private-pilot.json`
  - 采集、校验与人工审查工具
- **交付仓库**：`/Users/zhuleiye02/Git/terms`
  - `meta/anime.json`
  - `glossaries/anime_zh-CN.csv`
  - 正式发布时更新 `meta/index.json`
  - 仅在适合整个仓库时接收通用校验工具

原始网页、抓取缓存、临时产物和凭证不得提交。工作台当前没有远程仓库，但所有重要设计文档都应通过本地 Git 提交保留历史。

## Delivery Workflow

1. 在工作台中采样候选术语、补齐双向证据并完成审查。
2. 在 `terms` 仓库同步最新 `main`，创建短期交付分支。
3. 将已接受术语导出为三列 CSV，并生成对应元数据。
4. 对发布数据与工作台旁证执行双向一致性检查。
5. 完成自动检查和真实页面抽查后，提交上游 PR。
6. PR 合并后删除短期交付分支，继续在工作台维护下一批候选。

## Current Status

领域边界、旁证结构和校验流程已经确定。15 条术语的不公开试点已通过自动检查和两个候选站点的真实页面抽查；这不是正式发布批准。下一阶段扩充到 80 至 120 条正式首版候选，并完成每类至少两个真实页面和维护者复核。

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
