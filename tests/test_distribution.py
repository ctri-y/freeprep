import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / 'skills/freeprep'


class DistributionTest(unittest.TestCase):
    def test_skill_links_resolve_within_package(self):
        for file in SKILL.rglob('*.md'):
            for link in re.findall(r'\]\(([^)#]+)(?:#[^)]*)?\)', file.read_text()):
                if '://' in link:
                    continue
                target = (file.parent / link).resolve()
                self.assertTrue(target.is_relative_to(SKILL.resolve()), link)
                self.assertTrue(target.is_file(), f'{file.name}: {link}')

    def test_installed_skill_builds_without_repository(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            isolated = base / 'installed/freeprep'
            shutil.copytree(SKILL, isolated, ignore=shutil.ignore_patterns('__pycache__'))
            course = base / 'course.json'
            subprocess.run([sys.executable, str(isolated / 'scripts/starter.py'), '--out', str(course)], check=True, capture_output=True)
            data = json.loads(course.read_text())
            data['meta']['title'] = '</title><script>unexpected()</script>'
            data['lessons']['T01']['core'] = '</script><script>unexpected()</script>'
            course.write_text(json.dumps(data))
            output = base / 'out/index.html'
            subprocess.run(['node', str(isolated / 'scripts/build.mjs'), str(course), '--out', str(output)], check=True, capture_output=True)
            html = output.read_text()
            self.assertNotIn('</title><script>unexpected()', html)
            self.assertNotIn('</script><script>unexpected()', html)
            self.assertIn('freeprep:replace-with-course-id:ink:', html)
            self.assertTrue((base / 'out/storyboard.json').is_file())
            self.assertTrue((base / 'out/teacher-solutions.md').is_file())

    def test_public_sources_contain_no_private_paths_or_materials(self):
        roots = [SKILL, ROOT / 'examples', ROOT / 'schemas', ROOT / 'docs']
        for folder in roots:
            for file in folder.rglob('*'):
                if not file.is_file() or '__pycache__' in str(file):
                    continue
                self.assertNotIn(file.suffix.lower(), ('.pdf', '.pptx', '.docx'))
                if file.suffix in ('.png', '.jpg', '.webp'):
                    continue
                text = file.read_text()
                self.assertFalse(re.search(r'/Users/|/home/[^/\s]+/|/private/tmp/|/var/folders/', text), str(file))
                self.assertFalse(re.search(r'gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN .*PRIVATE KEY-----', text), str(file))


if __name__ == '__main__':
    unittest.main()
