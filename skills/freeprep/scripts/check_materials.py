#!/usr/bin/env python3
"""检查备课参数和题库结构；不验证学科答案、联网真实性或教学效果。"""
import argparse
import json
import math
from pathlib import Path


def check(config, questions, sources):
    errors = []
    if not isinstance(config, dict) or not isinstance(questions, list) or not isinstance(sources, list):
        return ['参数应为对象，题目与来源应为列表'], {}
    if any(not isinstance(x, dict) or not isinstance(x.get('id'), str) or not x['id'].strip() for x in questions + sources):
        return ['题目或来源对象无效，或编号缺失'], {}
    source_map = {s.get('id'): s for s in sources}
    if len(source_map) != len(sources):
        errors.append('来源编号重复')
    ids = [q.get('id') for q in questions]
    if None in ids or len(set(ids)) != len(ids):
        errors.append('题目编号缺失或重复')
    excluded = set(config.get('excluded_deliverables', []))
    included = set(config.get('deliverables', []))
    if included & excluded:
        errors.append('交付清单包含已排除项：' + ', '.join(sorted(included & excluded)))
    ratio = config.get('practice_share_min')
    if ratio is not None and (not isinstance(ratio, (int, float)) or isinstance(ratio, bool) or not 0 <= ratio <= 1):
        errors.append('practice_share_min 应在 0 至 1 之间')
    if config.get('pacing') == 'teacher-decides' and config.get('lesson_plan'):
        errors.append('教师自主节奏项目不应带固定分课时计划')
    counts = {}
    require_footer = bool(config.get('require_question_source_footer'))
    for q in questions:
        label = q.get('id', '?')
        review_index = q.get('content_stage') == 'storyboard-index'
        core_fields = ('module', 'target', 'difficulty',
                       'question_summary' if review_index else 'question',
                       'answer', 'reasoning')
        for key in core_fields:
            if not isinstance(q.get(key), str) or not q[key].strip():
                errors.append(f'{label} 缺少 {key}')
        if require_footer:
            for key in ('citation_label', 'source_year', 'source_place',
                        'year_kind', 'evidence_level'):
                if not isinstance(q.get(key), str) or not q[key].strip():
                    errors.append(f'{label} 题尾来源缺少 {key}')
        kind = q.get('source_kind')
        counts[kind] = counts.get(kind, 0) + 1
        if kind not in ('original', 'adapted', 'verbatim'):
            errors.append(f'{label} source_kind 无效')
        if kind in ('adapted', 'verbatim'):
            source = source_map.get(q.get('source_id'))
            if not source or not (source.get('url') or source.get('file')):
                errors.append(f'{label} 没有可定位来源')
            elif source.get('status') != 'read':
                errors.append(f'{label} 引用了未读取正文的来源')
            if not q.get('locator'):
                errors.append(f'{label} 没有原题定位')
            if kind == 'adapted' and not q.get('adaptation'):
                errors.append(f'{label} 没有改编说明')
        if kind == 'original' and q.get('source_id'):
            errors.append(f'{label} 原创题不得挂接外部题源')
    max_original = config.get('max_original_questions')
    if max_original is not None and (not isinstance(max_original, int) or isinstance(max_original, bool) or max_original < 0):
        errors.append('max_original_questions 应为非负整数')
    elif max_original is not None and counts.get('original', 0) > max_original:
        errors.append(f'原创题 {counts.get("original", 0)} 道，超过上限 {max_original} 道')
    return errors, counts


STORYBOARD = ('teaching_objective', 'core_concept', 'required_equations',
              'required_diagram', 'logical_sequence', 'recommended_slide_archetype',
              'visual_hierarchy', 'appear_immediately', 'progressively_revealed',
              'final_takeaway')


def check_course(data):
    """Runtime contract, not an assessment of educational quality."""
    if not isinstance(data, dict):
        return ['课程必须为 JSON 对象'], {}
    for key, kind in [('meta', dict), ('config', dict), ('questions', list),
                      ('sources', list), ('pages', list), ('lessons', dict)]:
        if not isinstance(data.get(key), kind):
            return [f'课程缺少或无效：{key}'], {}
    if any(not isinstance(x, dict) for x in data['questions'] + data['sources'] + data['pages']):
        return ['题目、来源及页面必须为对象'], {}
    errors, counts = check(data['config'], data['questions'], data['sources'])
    if any(not isinstance(q.get('id'), str) for q in data['questions']):
        return errors, counts
    if data.get('schema_version') != 1:
        errors.append('不支持的 schema_version')
    meta = data['meta']
    for key in ('id', 'title', 'short', 'scope', 'book', 'region'):
        if not isinstance(meta.get(key), str) or not meta[key].strip():
            errors.append(f'meta 缺少 {key}')
    modules = meta.get('modules', {})
    if not isinstance(modules, dict) or not modules:
        return errors + ['meta.modules 无效'], counts
    groups = meta.get('groups', [])
    if not groups or any(not isinstance(g, dict) or not g.get('mods') or
                         not g.get('title') or not g.get('n') or
                         any(m not in modules for m in g['mods']) for g in groups):
        errors.append('导航分组无效')
    elif set(modules) != {m for g in groups for m in g['mods']}:
        errors.append('导航未覆盖全部模块')
    pages, questions = data['pages'], data['questions']
    ids = [p.get('id') for p in pages]
    if not pages or any(not isinstance(i, str) or not i for i in ids) or len(ids) != len(set(ids)):
        errors.append('页面为空或编号缺失/重复')
    qmap = {q.get('id'): q for q in questions}
    for q in questions:
        qid = q.get('id')
        if q.get('module') not in modules:
            errors.append(f'{qid} 模块无效')
        if not q.get('title') or not q.get('review_focus'):
            errors.append(f'{qid} 缺少标题或讲评检查点')
        matches = [p for p in pages if p.get('kind') == 'practice' and p.get('id') == qid]
        if len(matches) != 1:
            errors.append(f'{qid} 应恰有一个独立练习页')
        if q.get('solution'):
            s = q['solution']
            if not isinstance(s, dict) or any(not s.get(k) for k in ('known', 'goal', 'steps', 'check', 'pitfalls')):
                errors.append(f'{qid} 完整解析字段不全')
            elif any(not isinstance(x, dict) or not x.get('formula') or not x.get('why') for x in s['steps']):
                errors.append(f'{qid} 完整解析缺少计算或说明')
            if not any(p.get('id') == 'SOL-' + qid and p.get('question_id') == qid and p.get('kind') == 'solution' for p in pages):
                errors.append(f'{qid} 缺少独立完整解析页')
    def diagram(f, label):
        if not isinstance(f, dict) or f.get('type') not in ('chart', 'numberline', 'map', 'table', 'image', 'demo', 'compound'):
            errors.append(f'{label} 图示类型无效')
            return
        kind = f['type']
        if kind == 'chart':
            for low, high in [('xmin', 'xmax'), ('ymin', 'ymax')]:
                lo, hi = f.get(low, 0), f.get(high, 5)
                if not all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in (lo, hi)) or lo >= hi:
                    errors.append(f'{label} 坐标范围无效')
            points = list(f.get('points', [])) + list(f.get('revealPoints', []))
            for s in f.get('series', []):
                points += s.get('points', [])
            for area in f.get('areas', []):
                points += area
            if any(not isinstance(p, list) or len(p) != 2 or not all(isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x) for x in p) for p in points):
                errors.append(f'{label} 数据点无效')
        elif kind == 'compound':
            if not f.get('parts'):
                errors.append(f'{label} 组合图为空')
            for part in f.get('parts', []):
                diagram(part, label)
        elif kind == 'image' and f.get('asset') not in data.get('assets', {}):
            errors.append(f'{label} 图片资源缺失')
        elif kind == 'map' and (not f.get('items') or any(not x.get('title') or not x.get('text') for x in f['items'])):
            errors.append(f'{label} 关系图数据不完整')
        elif kind == 'table' and (not f.get('headers') or not f.get('rows') or any(len(r) != len(f['headers']) for r in f['rows'])):
            errors.append(f'{label} 表格列数不一致')
        elif kind == 'numberline' and f.get('xmin', -2) >= f.get('xmax', 8):
            errors.append(f'{label} 数轴范围无效')
    for p in pages:
        pid, kind = p.get('id'), p.get('kind')
        if p.get('module') not in modules or not p.get('title'):
            errors.append(f'{pid} 页面模块或标题无效')
        if kind not in ('teaching', 'practice', 'solution'):
            errors.append(f'{pid} 页面类型无效')
        for key in STORYBOARD:
            if key not in p or p[key] is None:
                errors.append(f'{pid} 分镜缺少 {key}')
        diagram(p.get('diagram'), pid)
        if kind == 'practice' and pid not in qmap:
            errors.append(f'{pid} 找不到题目')
        if kind == 'solution' and not qmap.get(p.get('question_id'), {}).get('solution'):
            errors.append(f'{pid} 找不到完整解析')
        if kind == 'teaching':
            lesson = data['lessons'].get(pid, {})
            if not lesson.get('core') or not lesson.get('steps') or any(not s.get('main') or not s.get('why') for s in lesson.get('steps', [])):
                errors.append(f'{pid} 讲解步骤不完整')
    for q in questions:
        if q.get('solution_diagram'):
            diagram(q['solution_diagram'], q.get('id'))
    return errors, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--course', type=Path)
    parser.add_argument('--config', type=Path)
    parser.add_argument('--questions', type=Path)
    parser.add_argument('--sources', type=Path)
    args = parser.parse_args()
    if args.course:
        data = json.loads(args.course.read_text(encoding='utf-8'))
        errors, counts = check_course(data)
        question_count = len(data.get('questions', [])) if isinstance(data, dict) else 0
    else:
        if not all((args.config, args.questions, args.sources)):
            parser.error('提供 --course 或同时提供 --config、--questions、--sources')
        data = [json.loads(p.read_text(encoding='utf-8')) for p in
                (args.config, args.questions, args.sources)]
        errors, counts = check(*data)
        question_count = len(data[1])
    print(json.dumps({'structure_valid': not errors, 'question_count': question_count,
                      'source_counts': counts,
                      'manual_content_review_required': True,
                      'errors': errors}, ensure_ascii=False, indent=2))
    raise SystemExit(1 if errors else 0)


if __name__ == '__main__':
    main()
