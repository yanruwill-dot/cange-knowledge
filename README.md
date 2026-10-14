# 灿哥说车 · 二手车实战知识库

钴蓝主色的响应式知识库，静态 HTML/CSS/JavaScript，无第三方运行依赖。

## 使用

运行 `python3 -m http.server 8467` 后打开 http://localhost:8467 。

支持全文关键词搜索、8 类业务筛选、卡片/列表、文章阅读、收藏、已读、7 天学习路径、个人笔记、TXT/Markdown 导入、JSON 备份导出与合并恢复、CSV 清单下载。

所有个人数据仅保存在当前浏览器 localStorage，不具备账号、多人同步、在线后台或生成式 AI 问答。导入不是全站发布。JSON 恢复保留已有同 ID 笔记，避免覆盖当前记录。

## 内容边界

16 篇原创入门示例，待业务方审核；没有复制或导入 ima 订阅知识库的正文。用户提供的头像用于本网站品牌展示，不授予第三方再使用许可。

## 更新与部署

`data.js` 是公共知识内容源；修改后提交 main 自动通过 GitHub Actions 发布。仅 index.html、style.css、app.js、data.js 和 assets 进入部署目录。

检查：`node --check app.js`、`node --check data.js`。界面通过浏览器验证。

设计色：主色 #2457D6，悬停 #1945B4，深蓝 #13233D，浅蓝 #EDF3FF，灰白 #FBFCFE。静态资源同源，不依赖 Google Fonts 或外部 CDN。
