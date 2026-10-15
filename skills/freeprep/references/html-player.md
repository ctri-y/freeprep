# HTML 引擎

需要可离线授课的 HTML 时，使用本 skill 的 `assets/html-player/` 和 `scripts/build.mjs`。生成课程 JSON，按当前项目需要选择内容，不复制演示题充当有来源考试题。

完整课程示例在源码仓库的 `examples/motion/course.json`；如果只有单独 skill，运行 `scripts/starter.py --out course.json` 生成一个可用起点。起点明确标为模板，需要替换为本次已核验内容。

```sh
python3 scripts/check_materials.py --course course.json
node scripts/build.mjs course.json --out output/index.html
```

构建使用 Node.js 22+ 标准库；检查使用 Python 3.10+ 标准库，不依赖网络、API key 或浏览器库。输出的 HTML 直接打开；浏览器打印通过「打印练习」产生学生题单。构建同时输出分镜、来源台账与教师解析 Markdown；不会自动更新历史 PDF。

保留课程 ID 和稳定页面 ID，避免重建后批注失配。标题、地区、教材和模块从 `meta` 获取，不能保留其他项目的私人目录链接。

当前内置图示：`chart`、`numberline`、`map`、`table`、`compound`、`image`；物理 `demo` 是恒加速度直线运动。复杂图示按学科补充，或嵌入已核验且有权使用的图片。不要把未知类型自动降级成不相关的示意图。

公式当前为 Unicode 文本，不支持任意 LaTeX。对复杂公式改用适当工具并渲染核验。文本统一转义；示例不支持任意 HTML 作为教学内容。

解析 `solution` 包含 `known`、`goal`、`steps`（每步 `formula` 和 `why`）、`check`、`pitfalls`。练习页图示不能泄漏所求成图；解析用 `solution_diagram`。学生打印固定为初始题设，不包含教师答案。

全页批注、草稿与导入导出仅是授课辅助，浏览器存储不能代替备份。测试学生打印和手机布局后再交付。结构检查始终只报告结构有效性，不能替代教学和题源人工复核。
