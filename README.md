# mechanism-animation

一个给编码 Agent（Claude Code 等支持 Skill 的工具）用的技能：把「它是怎么工作的」做成一页**分步动画网页**。读者滚一下走一步，每一步只讲一件事，图里的东西按因果顺序出现、移动、消失。

产出是单个 HTML 文件，不依赖任何库，也不需要服务器。

## 里面有什么

| 文件 | 内容 |
|---|---|
| `mechanism-animation/SKILL.md` | 什么时候该做动画、流程、讲法规则、常见返工 |
| `mechanism-animation/assets/template.html` | 模板：引擎 + 一个 4 步的示例（没有缓存 → 加一层缓存），用浏览器打开就能看 |
| `mechanism-animation/scripts/check.js` | 自测脚本：动画有没有走完、文字有没有重叠 / 出框 / 太小、滚轮是否一步一格等 10 项，并导出每一步的截图 |
| `mechanism-animation/references/` | 分镜怎么写、引擎和小工具的用法、规则的出处（真实的反馈记录） |

## 怎么用

1. 把 `mechanism-animation/` 整个目录放进你的技能目录（Claude Code 是 `~/.claude/skills/`）。
2. 对 Agent 说「把 X 的工作原理做成分步动画」。它会先判断该不该做动画，再写分镜、从模板起页面、跑自测。
3. 自测脚本需要 Node 18+ 和 playwright：`npm i playwright && npx playwright install chromium`。

不用 Agent 也可以：复制 `assets/template.html`，按 `references/engine.md` 改脚本里的 A 段（步骤和文字）和 C 段（画面）。

## 说明

- 技能文档是中文的；模板和脚本里的注释也是中文。
- 规则都来自真实页面被读者打回的记录，`references/lessons.md` 里保留了原话和当时的改法。

## 许可

MIT，见 `LICENSE`。
