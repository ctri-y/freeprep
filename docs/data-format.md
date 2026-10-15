# 课程数据约定（v1）

以 `examples/motion/course.json` 为完整可运行实例，`schemas/course.schema.json` 描述基本字段。Python 检查器补充跨字段规则；两者都不能证明学科内容正确。

| 字段 | 用途 |
| --- | --- |
| `schema_version` | 当前为 `1` |
| `meta` | 稳定课程 ID、标题、教材说明、范围、地区、模块与导航分组 |
| `config` | 本项目的原创上限、讲练原则、交付清单、排除项、节奏等 |
| `sources` | 来源台账，记录 URL 或私有文件定位、读取状态等 |
| `questions` | 题干、题源身份、目标、答案、解析与可选完整计算 |
| `pages` | 有序页面与每页十项分镜、图示 |
| `lessons` | 讲解页的核心概念与逐步展开内容，以页面 ID 为键 |
| `hints` | 以题号为键的提示 |
| `assets` | 本地 PNG/JPEG/WebP 文件及署名信息；构建时嵌入 HTML |

## 稳定 ID 与关联

`meta.id` 隔离不同课程的草稿与批注。页面 `id` 在该课程内唯一；修改排版时保留 ID，题义改变时换 ID。练习页 `kind: practice` 的 ID 与题号相同。完整解析页使用 `SOL-题号`，`question_id` 指向原题。讲解页 `kind: teaching`，必须在 `lessons` 中有同 ID 条目。

`meta.modules` 是模块 ID 到名称的映射；`meta.groups` 中每个分组包含 `n`、`title` 和 `mods`，覆盖全部模块。

## 题源身份

`source_kind` 为 `verbatim`（原题）、`adapted`（改编）、`original`（原创）。原题和改编题必须引用 `source_id`，对应台账的 `status` 必须为 `read`，并提供原题 `locator`。改编题还需 `adaptation`；原创题不能挂名外部原题。

来源记录至少有 `id`、`status` 及 `url` 或 `file`，建议补充 `title`、`publisher`、`published_at`、`accessed_at`、`rights`、`evidence_note`。`file` 用于私有本地材料；公开前应检查是否暴露私人路径或未经授权的内容。

开启 `require_question_source_footer` 后，每题需 `citation_label`、`source_year`、`source_place`、`year_kind`、`evidence_level`。发布年不是考试年；无法核对时明确写「年份未核实」等真实状态，不编造。示例的 2026 是创作年。

## 图示与公式

当前内置 `chart`、`numberline`、`map`、`table`、`compound`、`image`，以及物理 `demo`。图示可含 `title` 和 `caption`。坐标数据以真实数值输入，渲染器把世界坐标 y 向上转换为 SVG 坐标。`revealPoints` 只在讲评或展开后出现，学生打印固定为 level 0。

`solution_diagram` 只用于教师完整解析，可显示辅助线、答案图和计算区域；不要把它替代练习页的题设图。

公式使用 Unicode 文本，如 `Δx = v₀t + ½at²`。当前没有通用 LaTeX 数学排版器；复杂分式、矩阵、化学式需要扩展渲染器并实看验收，不能宣称自动支持。

所有教学文本按纯文本转义，不能嵌入任意 HTML。图片记录示例：

```json
{"assets":{"setup":{"file":"images/setup.png","label":"实验装置","source":"作者及许可"}}}
```

本地路径相对课程 JSON。SVG 教学图在引擎内用代码制作；其他学科可补充图示类型，或嵌入已验证且有分发权的位图。
