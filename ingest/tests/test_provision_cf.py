"""scripts/provision_cf.sh must run the wrangler pinned in worker/package-lock.json (#392).

The script is run from a throwaway copy of the repo layout with fake `npm` and `npx` on PATH. The fake
`npm --prefix worker ci` plants a stub `worker/node_modules/.bin/wrangler`; `npx` fails the test if called.
"""

import os
import re
import shutil
import subprocess
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "provision_cf.sh"


def _run_script(tmp_path: Path, repo_name: str = "repo") -> list[str]:
    repo = tmp_path / repo_name
    (repo / "scripts").mkdir(parents=True)
    (repo / "worker").mkdir()
    shutil.copy(SCRIPT, repo / "scripts" / "provision_cf.sh")
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    log = tmp_path / "calls.log"
    (bin_dir / "npm").write_text(
        "#!/usr/bin/env bash\n"
        'echo "npm $*" >> "$CALL_LOG"\n'
        'if [ "$*" = "--prefix worker ci" ]; then\n'
        '  mkdir -p "$REPO_UNDER_TEST/worker/node_modules/.bin"\n'
        '  printf \'#!/usr/bin/env bash\\necho "wrangler $*" >> "$CALL_LOG"\\n\' '
        '> "$REPO_UNDER_TEST/worker/node_modules/.bin/wrangler"\n'
        '  chmod +x "$REPO_UNDER_TEST/worker/node_modules/.bin/wrangler"\n'
        "fi\n"
    )
    (bin_dir / "npx").write_text('#!/usr/bin/env bash\necho "npx $*" >> "$CALL_LOG"\nexit 99\n')
    for f in bin_dir.iterdir():
        f.chmod(0o755)
    env = {
        **os.environ,
        "PATH": f"{bin_dir}:{os.environ['PATH']}",
        "CALL_LOG": str(log),
        "REPO_UNDER_TEST": str(repo),
        "CLOUDFLARE_API_TOKEN": "test-token",
    }
    subprocess.run(["bash", str(repo / "scripts" / "provision_cf.sh")], env=env, check=True, capture_output=True)
    return log.read_text().splitlines()


def _wrangler_steps_in_script() -> int:
    """Invocations of the WRANGLER variable in the script (the assignment line excluded)."""
    return len(re.findall(r"^(?!WRANGLER=).*\$\{?WRANGLER", SCRIPT.read_text(), flags=re.M))


def test_every_wrangler_step_uses_the_locked_binary(tmp_path: Path) -> None:
    calls = _run_script(tmp_path)
    steps = _wrangler_steps_in_script()
    assert steps == 4, "update this test if a wrangler step was added or removed"
    assert not [c for c in calls if c.startswith("npx")], "npx must never resolve wrangler"
    assert len([c for c in calls if c.startswith("wrangler ")]) == steps, "a wrangler step bypassed the locked binary"


def test_checkout_path_with_a_space_works(tmp_path: Path) -> None:
    calls = _run_script(tmp_path, "my repo")
    assert len([c for c in calls if c.startswith("wrangler ")]) == _wrangler_steps_in_script()


def test_worker_deps_are_installed_before_the_first_wrangler_step(tmp_path: Path) -> None:
    calls = _run_script(tmp_path)
    assert calls.index("npm --prefix worker ci") < min(i for i, c in enumerate(calls) if c.startswith("wrangler "))
