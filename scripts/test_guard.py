"""
guard.py — PreToolUse 안전 가드 테스트.

stdin으로 전달되는 Claude Code 훅 JSON을 파싱해 위험한 쉘 명령을 차단한다.
POSIX(bash)와 PowerShell 양쪽 패턴을 커버하는지 검증한다.
"""

import io
import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import guard as g


# ---------------------------------------------------------------------------
# is_dangerous — 차단되어야 하는 명령
# ---------------------------------------------------------------------------

class TestDangerousPosix:
    @pytest.mark.parametrize("cmd", [
        "rm -rf /",
        "rm -rf ./build",
        "rm -fr node_modules",
        "rm -r -f dist",
        "rm --recursive --force foo",
        "sudo rm -rf --no-preserve-root /",
        "ls && rm -rf tmp",
    ])
    def test_rm_recursive_force_blocked(self, cmd):
        assert g.is_dangerous(cmd) is not None

    @pytest.mark.parametrize("cmd", [
        "git push --force",
        "git push -f origin main",
        "git push origin main --force",
    ])
    def test_git_push_force_blocked(self, cmd):
        assert g.is_dangerous(cmd) is not None

    def test_git_reset_hard_blocked(self):
        assert g.is_dangerous("git reset --hard HEAD~3") is not None

    def test_git_clean_force_blocked(self):
        assert g.is_dangerous("git clean -fd") is not None

    @pytest.mark.parametrize("cmd", [
        "psql -c 'DROP TABLE users'",
        "echo 'drop database prod' | mysql",
        "TRUNCATE TABLE sessions",
    ])
    def test_sql_destructive_blocked(self, cmd):
        assert g.is_dangerous(cmd) is not None

    def test_dd_disk_write_blocked(self):
        assert g.is_dangerous("dd if=/dev/zero of=/dev/sda") is not None

    def test_fork_bomb_blocked(self):
        assert g.is_dangerous(":(){ :|:& };:") is not None


class TestDangerousPowerShell:
    @pytest.mark.parametrize("cmd", [
        "Remove-Item -Recurse -Force .\\dist",
        "Remove-Item -Force -Recurse C:\\temp",
        "ri -r -fo build",
        "rmdir /s /q build",
    ])
    def test_powershell_recursive_force_blocked(self, cmd):
        assert g.is_dangerous(cmd) is not None

    def test_git_push_force_powershell(self):
        assert g.is_dangerous("git push --force-with-lease") is None  # lease는 허용


# ---------------------------------------------------------------------------
# is_dangerous — 통과해야 하는 안전한 명령
# ---------------------------------------------------------------------------

class TestSafe:
    @pytest.mark.parametrize("cmd", [
        "npm run build",
        "npm test",
        "git status",
        "git commit -m 'feat: add'",
        "git push origin feat-branch",
        "rm file.txt",
        "rm -f single.log",            # force지만 recursive 아님
        "rm -r emptydir",              # recursive지만 force 아님
        "ls -la",
        "cat README.md",
        "grep -rf pattern .",          # rf지만 rm이 아님
        "Remove-Item file.txt",        # 단일 파일
        "python scripts/execute.py 0-mvp",
        "",
    ])
    def test_safe_commands_pass(self, cmd):
        assert g.is_dangerous(cmd) is None


# ---------------------------------------------------------------------------
# main — stdin JSON 파싱 & 종료 코드
# ---------------------------------------------------------------------------

class TestMain:
    def _run(self, payload):
        """guard.main()을 stdin payload와 함께 실행, 종료 코드 반환."""
        stdin = io.StringIO(json.dumps(payload) if isinstance(payload, dict) else payload)
        code = g.main(stdin=stdin)
        return code

    def test_dangerous_command_exits_2(self):
        # PreToolUse에서 exit code 2 = 도구 호출 차단
        payload = {"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}
        assert self._run(payload) == 2

    def test_safe_command_exits_0(self):
        payload = {"tool_name": "Bash", "tool_input": {"command": "npm test"}}
        assert self._run(payload) == 0

    def test_malformed_json_fails_open(self):
        # 파싱 실패 시 워크플로우를 막지 않는다 (fail-open)
        assert self._run("not json{{{") == 0

    def test_missing_command_field_exits_0(self):
        payload = {"tool_name": "Bash", "tool_input": {}}
        assert self._run(payload) == 0

    def test_non_bash_tool_exits_0(self):
        payload = {"tool_name": "Read", "tool_input": {"file_path": "x"}}
        assert self._run(payload) == 0


# ---------------------------------------------------------------------------
# 서브프로세스 end-to-end (실제 stdin 파이프)
# ---------------------------------------------------------------------------

class TestSubprocess:
    GUARD = Path(__file__).parent / "guard.py"

    def test_blocks_via_real_stdin(self):
        payload = json.dumps({"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}})
        r = subprocess.run([sys.executable, str(self.GUARD)], input=payload,
                           capture_output=True, text=True, encoding="utf-8")
        assert r.returncode == 2
        assert r.stderr.strip() != ""

    def test_allows_via_real_stdin(self):
        payload = json.dumps({"tool_name": "Bash", "tool_input": {"command": "npm run build"}})
        r = subprocess.run([sys.executable, str(self.GUARD)], input=payload,
                           capture_output=True, text=True, encoding="utf-8")
        assert r.returncode == 0
