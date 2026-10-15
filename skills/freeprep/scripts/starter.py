#!/usr/bin/env python3
"""生成可运行的课程起点；示例文字需要替换为本次核验内容。"""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
page = {
    'id': 'T01', 'kind': 'teaching', 'module': 'M1', 'title': '一个概念，讲清依据',
    'content_locator': '模板示例：请替换为本次已读教材页码或内容定位',
    'teaching_objective': '说明概念解决的问题及使用条件',
    'core_concept': '从一个可以解释的具体问题开始。',
    'required_equations': [], 'required_diagram': '问题、依据与应用的关系图',
    'logical_sequence': ['问题', '依据', '应用'],
    'recommended_slide_archetype': '左解释、右证据图',
    'visual_hierarchy': '问题 → 证据 → 结论',
    'appear_immediately': '核心问题与证据图',
    'progressively_revealed': '定义、条件与应用逐步展开',
    'final_takeaway': '让每个结论都有说得清的依据。',
    'diagram': {'type': 'map', 'title': '问题、依据与应用',
                'caption': '课程模板示意；请换成本次教学证据。',
                'items': [{'title': '问题', 'text': '学生要解释什么？'},
                          {'title': '依据', 'text': '哪些定义、材料或事实支持解释？'},
                          {'title': '应用', 'text': '在什么条件下可以迁移？'}]},
}
data = {
    'schema_version': 1,
    'meta': {'id': 'replace-with-course-id', 'title': 'FreePrep 课程起点',
             'short': '课程模板', 'scope': '一页运行示例，尚非备课成品',
             'book': '请替换为实际教材及版本', 'region': '请按本次需求填写',
             'modules': {'M1': '核心概念'},
             'groups': [{'n': '01', 'title': '核心概念', 'mods': ['M1']}]},
    'config': {'pacing': 'teacher-decides', 'max_original_questions': 0,
               'require_question_source_footer': True,
               'deliverables': ['html'], 'excluded_deliverables': []},
    'pages': [page], 'questions': [], 'sources': [], 'hints': {}, 'assets': {},
    'lessons': {'T01': {'core': page['core_concept'],
                        'steps': [{'main': '说明依据与条件', 'why': '替换为本次学科的具体证据和推理。'},
                                  {'main': '迁移到一个新情境', 'why': '增加学生能独立完成的任务并给出反馈。'}]}},
}
if args.out.exists():
    parser.error('目标文件已存在；请另选路径以保留原内容。')
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(args.out)
