# 灿哥说车 · 二手车实战知识库

在线网站：https://yanruwill-dot.github.io/cange-knowledge/

## 内容

115 篇运营手册原文（55 篇基础运营、60 篇运营策略），9 个业务分类，保留 6 张表格；另保留 16 篇原创入门示例。资料来自用户提供的《二手车门店标准化运营手册》电子版，原文件标注“周小勇”。原文观点、案例、数据与制度条款须结合实际核验，不作为本站独立核实的事实或承诺。

目录、分页、全文搜索、分类/来源筛选、篇内目录、字号切换、上一篇/下一篇、收藏、已读、笔记、文本导入与备份均可使用。手册直接发布在公共站点，个人笔记与自行导入资料仍仅存在当前浏览器，不上传、不跨设备同步。

## 本地运行

```sh
python3 -m http.server 8467
node tests/content.test.mjs
```

主文件：`index.html`、`style.css`、`app.js`。`data.js` 保存入门示例，`manual-data.js` 保存手册全文及来源信息。所有运行资源同源，无第三方字体或 CDN 依赖。

## 链接

- `#manual`：按原书章节查看手册目录。
- `#library/sales?source=manual`：销售分类的手册文章。
- `#article/manual-basic-024`：销售全流程原文。
- `#path`：指向手册原文的 7 天建议学习路径。

## 手册转换

```sh
python3 scripts/import_manual.py --source /path/to/手册.docx
```

转换器针对这一版本的原书章节显式映射，保留源块范围和 SHA-256。只剔除目录页、装饰空白、明确页码与重复形状文本，不改写正文。不同版本需先核对章节再调整。可通过 `--index` 指定已提取索引额外校验；审计输出保存在忽略提交的 `qa/manual-import/`。

## 部署

提交到 main 后，GitHub Actions 先运行内容完整性检查，再发布站点。部署包仅包含前端文件与 assets；原始 DOCX、本地文件路径及 QA 原始提取数据不上传。
