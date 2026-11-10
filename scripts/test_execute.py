"""
execute.py 리팩터링 안전망 테스트.
리팩터링 전후 동작이 동일한지 검증한다.
"""

import json
import os
import subprocess
import sys
import textwrap
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent))
import execute as ex


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_project(tmp_path):
    """phases/, CLAUDE.md, docs/ 를 갖춘 임시 프로젝트 구조."""
    phases_dir = tmp_path / "phases"
    phases_dir.mkdir()

    claude_md = tmp_path / "CLAUDE.md"
    claude_md.write_text("# Rules\n- rule one\n- rule two", encoding="utf-8")

    docs_dir = tmp_path / "docs"
    docs_dir.mkdir()
    (docs_dir / "arch.md").write_text("# Architecture\nSome content", encoding="utf-8")
    (docs_dir / "guide.md").write_text("# Guide\nAnother doc", encoding="utf-8")

    return tmp_path


@pytest.fixture
def phase_dir(tmp_project):
    """step 3개를 가진 phase 디렉토리."""
    d = tmp_project / "phases" / "0-mvp"
    d.mkdir()

    index = {
        "project": "TestProject",
        "phase": "mvp",
        "steps": [
            {"step": 0, "name": "setup", "status": "completed", "summary": "프로젝트 초기화 완료"},
            {"step": 1, "name": "core", "status": "completed", "summary": "핵심 로직 구현"},
            {"step": 2, "name": "ui", "status": "pending"},
        ],
    }
    (d / "index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    (d / "step2.md").write_text("# Step 2: UI\n\nUI를 구현하세요.", encoding="utf-8")

    return d


@pytest.fixture
def top_index(tmp_project):
    """phases/index.json (top-level)."""
    top = {
        "phases": [
            {"dir": "0-mvp", "status": "pending"},
            {"dir": "1-polish", "status": "pending"},
        ]
    }
    p = tmp_project / "phases" / "index.json"
    p.write_text(json.dumps(top, indent=2), encoding="utf-8")
    return p


@pytest.fixture
def executor(tmp_project, phase_dir):
    """테스트용 StepExecutor 인스턴스. git 호출은 별도 mock 필요."""
    with patch.object(ex, "ROOT", tmp_project):
        inst = ex.StepExecutor("0-mvp")
    # 내부 경로를 tmp_project 기준으로 재설정
    inst._root = str(tmp_project)
    inst._phases_dir = tmp_project / "phases"
    inst._phase_dir = phase_dir
    inst._phase_dir_name = "0-mvp"
    inst._index_file = phase_dir / "index.json"
    inst._top_index_file = tmp_project / "phases" / "index.json"
    return inst


# ---------------------------------------------------------------------------
# _stamp (= 이전 now_iso)
# ---------------------------------------------------------------------------

class TestStamp:
    def test_returns_kst_timestamp(self, executor):
        result = executor._stamp()
        assert "+0900" in result

    def test_format_is_iso(self, executor):
        result = executor._stamp()
        dt = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert dt.tzinfo is not None

    def test_is_current_time(self, executor):
        before = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0)
        result = executor._stamp()
        after = datetime.now(ex.StepExecutor.TZ).replace(microsecond=0) + timedelta(seconds=1)
        parsed = datetime.strptime(result, "%Y-%m-%dT%H:%M:%S%z")
        assert before <= parsed <= after


# ---------------------------------------------------------------------------
# _read_json / _write_json
# ---------------------------------------------------------------------------

class TestJsonHelpers:
    def test_roundtrip(self, tmp_path):
        data = {"key": "값", "nested": [1, 2, 3]}
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, data)
        loaded = ex.StepExecutor._read_json(p)
        assert loaded == data

    def test_save_ensures_ascii_false(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"한글": "테스트"})
        raw = p.read_text(encoding="utf-8")
        assert "한글" in raw
        assert "\\u" not in raw

    def test_save_indented(self, tmp_path):
        p = tmp_path / "test.json"
        ex.StepExecutor._write_json(p, {"a": 1})
        raw = p.read_text(encoding="utf-8")
        assert "\n" in raw

    def test_load_nonexistent_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            ex.StepExecutor._read_json(tmp_path / "nope.json")


# ---------------------------------------------------------------------------
# _load_guardrails
# ---------------------------------------------------------------------------

class TestLoadGuardrails:
    def test_loads_claude_md_and_docs(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "# Rules" in result
        assert "rule one" in result
        assert "# Architecture" in result
        assert "# Guide" in result

    def test_sections_separated_by_divider(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "---" in result

    def test_docs_sorted_alphabetically(self, executor, tmp_project):
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        arch_pos = result.index("arch")
        guide_pos = result.index("guide")
        assert arch_pos < guide_pos

    def test_no_claude_md(self, executor, tmp_project):
        (tmp_project / "CLAUDE.md").unlink()
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "CLAUDE.md" not in result
        assert "Architecture" in result

    def test_no_docs_dir(self, executor, tmp_project):
        import shutil
        shutil.rmtree(tmp_project / "docs")
        with patch.object(ex, "ROOT", tmp_project):
            result = executor._load_guardrails()
        assert "Rules" in result
        assert "Architecture" not in result

    def test_empty_project(self, tmp_path):
        with patch.object(ex, "ROOT", tmp_path):
            # executor가 필요 없는 static-like 동작이므로 임시 인스턴스
            phases_dir = tmp_path / "phases" / "dummy"
            phases_dir.mkdir(parents=True)
            idx = {"project": "T", "phase": "t", "steps": []}
            (phases_dir / "index.json").write_text(json.dumps(idx), encoding="utf-8")
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
            result = inst._load_guardrails()
        assert result == ""


# ---------------------------------------------------------------------------
# _build_step_context
# ---------------------------------------------------------------------------

class TestBuildStepContext:
    def test_includes_completed_with_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        result = ex.StepExecutor._build_step_context(index)
        assert "Step 0 (setup): 프로젝트 초기화 완료" in result
        assert "Step 1 (core): 핵심 로직 구현" in result

    def test_excludes_pending(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        result = ex.StepExecutor._build_step_context(index)
        assert "ui" not in result

    def test_excludes_completed_without_summary(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        del index["steps"][0]["summary"]
        result = ex.StepExecutor._build_step_context(index)
        assert "setup" not in result
        assert "core" in result

    def test_empty_when_no_completed(self):
        index = {"steps": [{"step": 0, "name": "a", "status": "pending"}]}
        result = ex.StepExecutor._build_step_context(index)
        assert result == ""

    def test_has_header(self, phase_dir):
        index = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
        result = ex.StepExecutor._build_step_context(index)
        assert result.startswith("## 이전 Step 산출물")


# ---------------------------------------------------------------------------
# _build_preamble
# ---------------------------------------------------------------------------

class TestBuildPreamble:
    def test_includes_project_name(self, executor):
        result = executor._build_preamble("", "")
        assert "TestProject" in result

    def test_includes_guardrails(self, executor):
        result = executor._build_preamble("GUARD_CONTENT", "")
        assert "GUARD_CONTENT" in result

    def test_includes_step_context(self, executor):
        ctx = "## 이전 Step 산출물\n\n- Step 0: done"
        result = executor._build_preamble("", ctx)
        assert "이전 Step 산출물" in result

    def test_includes_commit_example(self, executor):
        result = executor._build_preamble("", "")
        assert "feat(mvp):" in result

    def test_includes_rules(self, executor):
        result = executor._build_preamble("", "")
        assert "작업 규칙" in result
        assert "AC" in result

    def test_no_retry_section_by_default(self, executor):
        result = executor._build_preamble("", "")
        assert "이전 시도 실패" not in result

    def test_retry_section_with_prev_error(self, executor):
        result = executor._build_preamble("", "", prev_error="타입 에러 발생")
        assert "이전 시도 실패" in result
        assert "타입 에러 발생" in result

    def test_includes_max_retries(self, executor):
        result = executor._build_preamble("", "")
        assert str(ex.StepExecutor.MAX_RETRIES) in result

    def test_includes_index_path(self, executor):
        result = executor._build_preamble("", "")
        assert "/phases/0-mvp/index.json" in result


# ---------------------------------------------------------------------------
# _update_top_index
# ---------------------------------------------------------------------------

class TestUpdateTopIndex:
    def test_completed(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text(encoding="utf-8"))
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "completed"
        assert "completed_at" in mvp

    def test_error(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("error")
        data = json.loads(top_index.read_text(encoding="utf-8"))
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "error"
        assert "failed_at" in mvp

    def test_blocked(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("blocked")
        data = json.loads(top_index.read_text(encoding="utf-8"))
        mvp = next(p for p in data["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "blocked"
        assert "blocked_at" in mvp

    def test_other_phases_unchanged(self, executor, top_index):
        executor._top_index_file = top_index
        executor._update_top_index("completed")
        data = json.loads(top_index.read_text(encoding="utf-8"))
        polish = next(p for p in data["phases"] if p["dir"] == "1-polish")
        assert polish["status"] == "pending"

    def test_nonexistent_dir_is_noop(self, executor, top_index):
        executor._top_index_file = top_index
        executor._phase_dir_name = "no-such-dir"
        original = json.loads(top_index.read_text(encoding="utf-8"))
        executor._update_top_index("completed")
        after = json.loads(top_index.read_text(encoding="utf-8"))
        for p_before, p_after in zip(original["phases"], after["phases"]):
            assert p_before["status"] == p_after["status"]

    def test_no_top_index_file(self, executor, tmp_path):
        executor._top_index_file = tmp_path / "nonexistent.json"
        executor._update_top_index("completed")  # should not raise


# ---------------------------------------------------------------------------
# _checkout_branch (mocked)
# ---------------------------------------------------------------------------

class TestCheckoutBranch:
    def _mock_git(self, executor, responses):
        call_idx = {"i": 0}
        def fake_git(*args):
            idx = call_idx["i"]
            call_idx["i"] += 1
            if idx < len(responses):
                return responses[idx]
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

    def test_already_on_branch(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="feat-mvp\n", stderr=""),
        ])
        executor._checkout_branch()  # should return without checkout

    def test_branch_exists_checkout(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_branch_not_exists_create(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="not found"),
            MagicMock(returncode=0, stdout="", stderr=""),
        ])
        executor._checkout_branch()

    def test_checkout_fails_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=0, stdout="main\n", stderr=""),
            MagicMock(returncode=1, stdout="", stderr=""),
            MagicMock(returncode=1, stdout="", stderr="dirty tree"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1

    def test_no_git_exits(self, executor):
        self._mock_git(executor, [
            MagicMock(returncode=1, stdout="", stderr="not a git repo"),
        ])
        with pytest.raises(SystemExit) as exc_info:
            executor._checkout_branch()
        assert exc_info.value.code == 1


# ---------------------------------------------------------------------------
# _commit_step (mocked)
# ---------------------------------------------------------------------------

class TestCommitStep:
    def test_two_phase_commit(self, executor):
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_calls = [c for c in calls if c[0] == "commit"]
        assert len(commit_calls) == 2
        assert "feat(mvp):" in commit_calls[0][2]
        assert "chore(mvp):" in commit_calls[1][2]

    def test_no_code_changes_skips_feat_commit(self, executor):
        call_count = {"diff": 0}
        calls = []
        def fake_git(*args):
            calls.append(args)
            if args[:2] == ("diff", "--cached"):
                call_count["diff"] += 1
                if call_count["diff"] == 1:
                    return MagicMock(returncode=0)
                return MagicMock(returncode=1)
            return MagicMock(returncode=0, stdout="", stderr="")
        executor._run_git = fake_git

        executor._commit_step(2, "ui")

        commit_msgs = [c[2] for c in calls if c[0] == "commit"]
        assert len(commit_msgs) == 1
        assert "chore" in commit_msgs[0]


# ---------------------------------------------------------------------------
# _invoke_claude (mocked)
# ---------------------------------------------------------------------------

class TestInvokeClaude:
    def test_invokes_claude_with_correct_args(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"result": "ok"}', stderr="")
        step = {"step": 2, "name": "ui"}
        preamble = "PREAMBLE\n"

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            output = executor._invoke_claude(step, preamble)

        cmd = mock_run.call_args[0][0]
        assert cmd[0] == "claude"
        assert "-p" in cmd
        assert "--dangerously-skip-permissions" in cmd
        assert "--output-format" in cmd
        assert "PREAMBLE" in cmd[-1]
        assert "UI를 구현하세요" in cmd[-1]

    def test_saves_output_json(self, executor):
        mock_result = MagicMock(returncode=0, stdout='{"ok": true}', stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result):
            executor._invoke_claude(step, "preamble")

        output_file = executor._phase_dir / "step2-output.json"
        assert output_file.exists()
        data = json.loads(output_file.read_text(encoding="utf-8"))
        assert data["step"] == 2
        assert data["name"] == "ui"
        assert data["exitCode"] == 0

    def test_nonexistent_step_file_exits(self, executor):
        step = {"step": 99, "name": "nonexistent"}
        with pytest.raises(SystemExit) as exc_info:
            executor._invoke_claude(step, "preamble")
        assert exc_info.value.code == 1

    def test_timeout_is_1800(self, executor):
        mock_result = MagicMock(returncode=0, stdout="{}", stderr="")
        step = {"step": 2, "name": "ui"}

        with patch("subprocess.run", return_value=mock_result) as mock_run:
            executor._invoke_claude(step, "preamble")

        assert mock_run.call_args[1]["timeout"] == 1800

    def test_timeout_does_not_crash(self, executor):
        """Claude 호출 타임아웃 시 예외를 던지지 않고 미완료(124)로 처리한다."""
        step = {"step": 2, "name": "ui"}
        with patch("subprocess.run",
                   side_effect=subprocess.TimeoutExpired("claude", 1800)):
            output = executor._invoke_claude(step, "preamble")
        assert output["exitCode"] == 124
        assert "TIMEOUT" in output["stderr"]
        # 디버깅용 output 파일도 정상 기록
        out_file = executor._phase_dir / "step2-output.json"
        assert out_file.exists()
        assert json.loads(out_file.read_text(encoding="utf-8"))["exitCode"] == 124


# ---------------------------------------------------------------------------
# progress_indicator (= 이전 Spinner)
# ---------------------------------------------------------------------------

class TestProgressIndicator:
    def test_context_manager(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.15)
        assert pi.elapsed >= 0.1

    def test_elapsed_increases(self):
        import time
        with ex.progress_indicator("test") as pi:
            time.sleep(0.2)
        assert pi.elapsed > 0


# ---------------------------------------------------------------------------
# main() CLI 파싱 (mocked)
# ---------------------------------------------------------------------------

class TestMainCli:
    def test_no_args_exits(self):
        with patch("sys.argv", ["execute.py"]):
            with pytest.raises(SystemExit) as exc_info:
                ex.main()
            assert exc_info.value.code == 2  # argparse exits with 2

    def test_invalid_phase_dir_exits(self):
        with patch("sys.argv", ["execute.py", "nonexistent"]):
            with patch.object(ex, "ROOT", Path("/tmp/fake_nonexistent")):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1

    def test_missing_index_exits(self, tmp_project):
        (tmp_project / "phases" / "empty").mkdir()
        with patch("sys.argv", ["execute.py", "empty"]):
            with patch.object(ex, "ROOT", tmp_project):
                with pytest.raises(SystemExit) as exc_info:
                    ex.main()
                assert exc_info.value.code == 1

    def test_reset_flag_does_not_run(self, tmp_project, phase_dir):
        with patch("sys.argv", ["execute.py", "0-mvp", "--reset"]):
            with patch.object(ex, "ROOT", tmp_project):
                with patch.object(ex.StepExecutor, "run") as mock_run:
                    ex.main()
                mock_run.assert_not_called()


# ---------------------------------------------------------------------------
# _check_blockers (= 이전 main() error/blocked 체크)
# ---------------------------------------------------------------------------

class TestCheckBlockers:
    def _make_executor_with_steps(self, tmp_project, steps):
        d = tmp_project / "phases" / "test-phase"
        d.mkdir(exist_ok=True)
        index = {"project": "T", "phase": "test", "steps": steps}
        (d / "index.json").write_text(json.dumps(index), encoding="utf-8")

        with patch.object(ex, "ROOT", tmp_project):
            inst = ex.StepExecutor.__new__(ex.StepExecutor)
        inst._root = str(tmp_project)
        inst._phases_dir = tmp_project / "phases"
        inst._phase_dir = d
        inst._phase_dir_name = "test-phase"
        inst._index_file = d / "index.json"
        inst._top_index_file = tmp_project / "phases" / "index.json"
        inst._phase_name = "test"
        inst._total = len(steps)
        return inst

    def test_error_step_exits_1(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "bad", "status": "error", "error_message": "fail"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 1

    def test_blocked_step_exits_2(self, tmp_project):
        steps = [
            {"step": 0, "name": "ok", "status": "completed"},
            {"step": 1, "name": "stuck", "status": "blocked", "blocked_reason": "API key"},
        ]
        inst = self._make_executor_with_steps(tmp_project, steps)
        with pytest.raises(SystemExit) as exc_info:
            inst._check_blockers()
        assert exc_info.value.code == 2


# ---------------------------------------------------------------------------
# AC 독립 검증 — _get_ac / _verify_ac
# ---------------------------------------------------------------------------

def _set_default_ac(phase_dir, ac):
    idx = json.loads((phase_dir / "index.json").read_text(encoding="utf-8"))
    idx["default_ac"] = ac
    (phase_dir / "index.json").write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")


class TestGetAc:
    def test_step_level_ac(self, executor):
        step = {"step": 2, "name": "ui", "ac": ["npm run build"]}
        assert executor._get_ac(step) == ["npm run build"]

    def test_default_ac_fallback(self, executor, phase_dir):
        _set_default_ac(phase_dir, ["npm test"])
        assert executor._get_ac({"step": 2, "name": "ui"}) == ["npm test"]

    def test_none_returns_empty(self, executor):
        assert executor._get_ac({"step": 2, "name": "ui"}) == []

    def test_step_overrides_default(self, executor, phase_dir):
        _set_default_ac(phase_dir, ["npm test"])
        step = {"step": 2, "name": "ui", "ac": ["echo hi"]}
        assert executor._get_ac(step) == ["echo hi"]


class TestVerifyAc:
    def test_no_ac_passes(self, executor):
        ok, _ = executor._verify_ac({"step": 2, "name": "ui"})
        assert ok is True

    def test_all_pass(self, executor):
        step = {"step": 2, "name": "ui", "ac": ["cmd1", "cmd2"]}
        with patch("subprocess.run", return_value=MagicMock(returncode=0, stdout="", stderr="")):
            ok, out = executor._verify_ac(step)
        assert ok is True
        assert "[ok]" in out

    def test_first_failure_short_circuits(self, executor):
        step = {"step": 2, "name": "ui", "ac": ["bad", "never"]}
        calls = []

        def fake_run(cmd, **kw):
            calls.append(cmd)
            return MagicMock(returncode=1, stdout="boom", stderr="errtext")
        with patch("subprocess.run", side_effect=fake_run):
            ok, out = executor._verify_ac(step)
        assert ok is False
        assert "boom" in out or "errtext" in out
        assert calls == ["bad"]  # 두 번째 커맨드는 실행되지 않는다

    def test_timeout_is_failure(self, executor):
        step = {"step": 2, "name": "ui", "ac": ["slow"]}
        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("slow", 900)):
            ok, out = executor._verify_ac(step)
        assert ok is False
        assert "TIMEOUT" in out


# ---------------------------------------------------------------------------
# AC 게이팅 통합 — completed 자기신고를 AC로 검증
# ---------------------------------------------------------------------------

class TestAcGating:
    def _mock_invoke_sets_completed(self, executor):
        def fake_invoke(step, preamble):
            idx = json.loads(executor._index_file.read_text(encoding="utf-8"))
            for s in idx["steps"]:
                if s["step"] == step["step"]:
                    s["status"] = "completed"
                    s["summary"] = "done"
            executor._index_file.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
            return {}
        executor._invoke_claude = fake_invoke

    def test_completed_and_ac_passes(self, executor, phase_dir):
        _set_default_ac(phase_dir, ["npm test"])
        self._mock_invoke_sets_completed(executor)
        executor._commit_step = lambda *a: None
        executor._verify_ac = lambda step: (True, "ok")

        assert executor._execute_single_step({"step": 2, "name": "ui"}, "") is True
        idx = json.loads(executor._index_file.read_text(encoding="utf-8"))
        s2 = next(s for s in idx["steps"] if s["step"] == 2)
        assert s2["status"] == "completed"
        assert "completed_at" in s2

    def test_ac_fail_then_pass_retries(self, executor, phase_dir):
        _set_default_ac(phase_dir, ["npm test"])
        self._mock_invoke_sets_completed(executor)
        executor._commit_step = lambda *a: None

        verify_calls = {"n": 0}

        def verify(step):
            verify_calls["n"] += 1
            return (False, "ac boom") if verify_calls["n"] == 1 else (True, "")
        executor._verify_ac = verify

        invoke_calls = {"n": 0}
        base_invoke = executor._invoke_claude

        def counting(step, preamble):
            invoke_calls["n"] += 1
            return base_invoke(step, preamble)
        executor._invoke_claude = counting

        assert executor._execute_single_step({"step": 2, "name": "ui"}, "") is True
        assert invoke_calls["n"] == 2   # 재시도 1회
        assert verify_calls["n"] == 2

    def test_ac_fail_all_attempts_errors(self, executor, phase_dir):
        _set_default_ac(phase_dir, ["npm test"])
        self._mock_invoke_sets_completed(executor)
        executor._commit_step = lambda *a: None
        executor._update_top_index = lambda *a: None
        executor._verify_ac = lambda step: (False, "always boom")

        with pytest.raises(SystemExit) as exc_info:
            executor._execute_single_step({"step": 2, "name": "ui"}, "")
        assert exc_info.value.code == 1
        idx = json.loads(executor._index_file.read_text(encoding="utf-8"))
        s2 = next(s for s in idx["steps"] if s["step"] == 2)
        assert s2["status"] == "error"
        assert "AC" in s2["error_message"]


# ---------------------------------------------------------------------------
# 동시 실행 락 — _acquire_lock / _release_lock
# ---------------------------------------------------------------------------

class TestLock:
    def test_acquire_creates_lockfile(self, executor):
        executor._acquire_lock()
        assert (executor._phase_dir / ".execute.lock").exists()
        executor._release_lock()

    def test_second_acquire_exits_3(self, executor):
        executor._acquire_lock()
        try:
            with pytest.raises(SystemExit) as exc_info:
                executor._acquire_lock()
            assert exc_info.value.code == 3
        finally:
            executor._release_lock()

    def test_release_removes_lockfile(self, executor):
        executor._acquire_lock()
        executor._release_lock()
        assert not (executor._phase_dir / ".execute.lock").exists()

    def test_release_without_lock_is_safe(self, executor):
        executor._release_lock()  # should not raise


# ---------------------------------------------------------------------------
# 복구 — reset()
# ---------------------------------------------------------------------------

class TestReset:
    def _write_steps(self, executor, steps):
        idx = json.loads(executor._index_file.read_text(encoding="utf-8"))
        idx["steps"] = steps
        executor._index_file.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")

    def test_resets_error_and_blocked(self, executor):
        self._write_steps(executor, [
            {"step": 0, "name": "a", "status": "completed", "summary": "done"},
            {"step": 1, "name": "b", "status": "error", "error_message": "boom", "failed_at": "t"},
            {"step": 2, "name": "c", "status": "blocked", "blocked_reason": "key", "blocked_at": "t"},
        ])
        n = executor.reset()
        assert n == 2
        idx = json.loads(executor._index_file.read_text(encoding="utf-8"))
        assert idx["steps"][1]["status"] == "pending"
        assert "error_message" not in idx["steps"][1]
        assert "failed_at" not in idx["steps"][1]
        assert idx["steps"][2]["status"] == "pending"
        assert "blocked_reason" not in idx["steps"][2]

    def test_keeps_completed_untouched(self, executor):
        self._write_steps(executor, [
            {"step": 0, "name": "a", "status": "completed", "summary": "done"},
        ])
        executor.reset()
        idx = json.loads(executor._index_file.read_text(encoding="utf-8"))
        assert idx["steps"][0]["status"] == "completed"
        assert idx["steps"][0]["summary"] == "done"

    def test_resets_top_index(self, executor, top_index):
        executor._top_index_file = top_index
        top = json.loads(top_index.read_text(encoding="utf-8"))
        top["phases"][0]["status"] = "error"
        top["phases"][0]["failed_at"] = "t"
        top_index.write_text(json.dumps(top, ensure_ascii=False), encoding="utf-8")

        self._write_steps(executor, [
            {"step": 0, "name": "a", "status": "error", "error_message": "x"},
        ])
        executor.reset()
        after = json.loads(top_index.read_text(encoding="utf-8"))
        mvp = next(p for p in after["phases"] if p["dir"] == "0-mvp")
        assert mvp["status"] == "pending"
        assert "failed_at" not in mvp
