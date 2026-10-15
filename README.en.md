# FreePrep

**Less prep. More teaching.**

An open lesson-preparation skill with a reusable, offline HTML teaching player. It helps an AI assistant verify textbook editions and official requirements, select traceable exercises, write complete worked solutions, plan teaching and visual storyboards, and revise materials from teacher feedback.

[中文](README.md) · [Live demo](https://ctri-y.github.io/freeprep/) · [Workflow](docs/workflow.md)

The workflow is subject-agnostic. Iterative teacher evaluation so far covers **Chinese junior- and senior-secondary physics**; equivalent validation for other subjects remains to be done. The public 10-page example contains two explicitly original demonstration questions, not exam questions or a complete chapter.

## Use the skill

Install the entire `skills/freeprep` directory in your assistant's skills directory, or ask the assistant to read its `SKILL.md`. For Codex, you can ask `$skill-installer` to install:

```text
https://github.com/ctri-y/freeprep/tree/main/skills/freeprep
```

Provide the subject, grade, region, actual textbook, full scope, learner needs, exercise-source policy, deliverables, and approval preferences. Generation uses your assistant's tools and model access; FreePrep does not bundle a model service or licensed question bank.

## Build the example

Requires Node.js 22+ and Python 3.10+. No API keys or npm dependencies are needed to build:

```sh
npm run build
```

Open `dist/index.html`. The player supports fade transitions, progressive reveals, search, full-page annotations, annotation import/export, dedicated solution pages, and answer-free student printouts. Course data and the player are editable. Annotations are browser-local; export them for backup or transfer.

For tests: `npm ci`, `python3 -m pip install -r requirements-dev.txt`, `npx playwright install chromium`, then `npm test`.

## License and limits

Original skill instructions, code, documentation, and demo content are MIT licensed, including commercial use. Third-party educational material is not included or relicensed. Automated checks validate structure and selected runtime behavior; they do not certify academic correctness or teaching effectiveness. See [third-party material](THIRD_PARTY.md) and [limitations](docs/limitations.md).
