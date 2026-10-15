import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT / 'skills/freeprep/scripts/check_materials.py'
spec = importlib.util.spec_from_file_location('materials', CHECK)
materials = importlib.util.module_from_spec(spec)
spec.loader.exec_module(materials)


class MaterialsTest(unittest.TestCase):
    def setUp(self):
        self.course = json.loads((ROOT / 'examples/motion/course.json').read_text())

    def errors(self):
        return materials.check_course(self.course)[0]

    def test_example_contract(self):
        self.assertEqual(self.errors(), [])

    def test_published_schema_matches_example(self):
        schema = json.loads((ROOT / 'schemas/course.schema.json').read_text())
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(self.course)

    def test_source_requires_read_body_and_locator(self):
        q = self.course['questions'][0]
        q.update(source_kind='verbatim', source_id='paper', locator='第 2 题')
        self.course['sources'] = [{'id': 'paper', 'file': 'private/paper.pdf', 'status': 'candidate'}]
        self.assertTrue(any('未读取' in e for e in self.errors()))
        self.course['sources'][0]['status'] = 'read'
        self.assertEqual(self.errors(), [])
        q.pop('locator')
        self.assertTrue(any('原题定位' in e for e in self.errors()))

    def test_adaptation_must_describe_changes(self):
        q = self.course['questions'][0]
        q.update(source_kind='adapted', source_id='paper', locator='p.12 Q3')
        q.pop('adaptation')
        self.course['sources'] = [{'id': 'paper', 'url': 'https://example.org/paper', 'status': 'read'}]
        self.assertTrue(any('改编说明' in e for e in self.errors()))

    def test_original_cap_and_false_attribution(self):
        self.course['config']['max_original_questions'] = 1
        self.assertTrue(any('超过上限' in e for e in self.errors()))
        self.course['questions'][0]['source_id'] = 'fake-exam'
        self.assertTrue(any('原创题不得' in e for e in self.errors()))

    def test_duplicate_pages_and_broken_solution(self):
        self.course['pages'].append(copy.deepcopy(self.course['pages'][0]))
        self.assertTrue(any('重复' in e for e in self.errors()))
        self.course['pages'] = [p for p in self.course['pages'] if p['id'] != 'SOL-Q02']
        self.assertTrue(any('独立完整解析页' in e for e in self.errors()))

    def test_storyboard_and_axis_range(self):
        self.course['pages'][0].pop('appear_immediately')
        self.course['pages'][3]['diagram']['ymin'] = 6
        self.assertTrue(any('分镜' in e for e in self.errors()))
        self.assertTrue(any('坐标范围' in e for e in self.errors()))

    def test_pacing_and_exclusions(self):
        self.course['config'].update(lesson_plan=['50 min'], deliverables=['prelearning'])
        errors = self.errors()
        self.assertTrue(any('已排除' in e for e in errors))
        self.assertTrue(any('分课时' in e for e in errors))

    def test_cli_never_certifies_teaching_readiness(self):
        result = subprocess.run([sys.executable, str(CHECK), '--course', str(ROOT / 'examples/motion/course.json')], capture_output=True, text=True, check=True)
        report = json.loads(result.stdout)
        self.assertTrue(report['structure_valid'])
        self.assertTrue(report['manual_content_review_required'])
        self.assertNotIn('ready_for_student_use', report)

    def test_standalone_starter_works(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'course.json'
            subprocess.run([sys.executable, str(CHECK.parent / 'starter.py'), '--out', str(target)], check=True, capture_output=True)
            course = json.loads(target.read_text())
            self.assertEqual(materials.check_course(course)[0], [])
            schema = json.loads((ROOT / 'schemas/course.schema.json').read_text())
            Draft202012Validator(schema).validate(course)

    def test_example_numbers_independently(self):
        # Independent arithmetic checks for the published worked examples.
        positions = [-2, 4, 1]
        displacement = positions[-1] - positions[0]
        distance = sum(abs(b-a) for a, b in zip(positions, positions[1:]))
        self.assertEqual((displacement, distance), (3, 9))
        self.assertEqual((displacement / 5, distance / 5), (.6, 1.8))
        velocities = [4 - 2*t for t in range(5)]
        signed_areas = [(a+b)/2 for a, b in zip(velocities, velocities[1:])]
        self.assertEqual(sum(signed_areas), 0)
        self.assertEqual(sum(abs(a) for a in signed_areas), 8)
        self.assertEqual(velocities[2], 0)
        self.assertEqual((velocities[-1]-velocities[0])/4, -2)


if __name__ == '__main__':
    unittest.main()
