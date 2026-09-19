# Contributing

Issues and pull requests are welcome. See [SUPPORT.md](SUPPORT.md) for bug reports and [SECURITY.md](SECURITY.md) for vulnerabilities.

## Development setup

Requirements: Node.js, pnpm, Python 3.10+, and a desktop VS Code or Cursor installation. Clone the repository, then run:

```bash
pnpm install --frozen-lockfile
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

On Windows, use `.venv\Scripts\python.exe`. Use **Run Extension** in a development editor host or package a VSIX with `pnpm run package`. Configure `vivi.pythonPath` in that host to point to your development virtual environment.

## Checks

Run these before submitting a pull request:

```bash
pnpm run check
pnpm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -q
pnpm run package
```

`tests/fixtures/` contains repeatable image samples. `tests/generate_fixtures.py` can regenerate them. For a new format or stack operation, add a small fixture-based test that checks dtype, pixel values, shape, and axis interpretation where relevant.

## Pull requests and releases

- Explain visible behavior, test results, and limitations. Include screenshots for interface changes.
- Add a note under `Unreleased` in `changelog.md` for user-facing changes.
- Keep the public extension ID `Suzuka24.vivi` stable. Coordinate any package manifest or dependency change before merging.
- Do not commit personal data, server datasets, credentials, logs, virtual environments, or generated VSIX files.
- Follow [PUBLISHING.md](PUBLISHING.md) for marketplace release preparation.
