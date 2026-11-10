#!/usr/bin/env python3
"""
Harness PreToolUse 안전 가드.

Claude Code 는 PreToolUse 훅에 도구 입력을 **stdin JSON** 으로 전달한다
(환경변수가 아니다). 이 스크립트는 그 JSON 을 파싱해 Bash/쉘 명령이 위험하면
exit code 2 로 도구 호출을 차단한다. (PreToolUse 에서 2 = block, 그 외 = 통과)

POSIX(bash) 와 PowerShell 양쪽 패턴을 커버한다 — 이 하네스는 Windows 에서도
돈다.

settings.json 연결:
    "PreToolUse": [{ "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "python scripts/guard.py" }] }]
"""

import json
import re
import sys
from typing import Optional, TextIO


# 차단 대상이 아닌데 rm 으로 오탐되지 않도록, 각 규칙은 command 전체 문자열(소문자)
# 에 대해 평가한다. 반환값은 사람이 읽을 사유(차단) 또는 None(허용).

def _short_flags(low: str) -> str:
    """'-rf -x --long' 같은 입력에서 묶인 단문자 플래그를 전부 모아 반환.

    '-rf' -> 'rf', '-r -f' -> 'rf'. 장문 플래그(--force)는 포함하지 않는다.
    """
    joined = "".join(re.findall(r"(?:^|\s)-([a-z]+)", low))
    return joined


def _is_rm_recursive_force(low: str) -> bool:
    # 명령 토큰으로 rm 이 등장하는가 (경로 안의 'storm' 등 오탐 방지)
    if not re.search(r"(?:^|[\s;&|(])rm\b", low):
        return False
    flags = _short_flags(low)
    recursive = "r" in flags or "--recursive" in low
    force = "f" in flags or "--force" in low
    return recursive and force


def _is_powershell_remove(low: str) -> bool:
    # Remove-Item / ri / rd / rmdir 의 recursive+force 조합
    if re.search(r"(?:^|[\s;&|(])(remove-item|ri|rd)\b", low):
        recursive = "-recurse" in low or "-r " in low or low.endswith("-r")
        force = "-force" in low or "-fo" in low or "-f " in low
        if recursive and force:
            return True
    if re.search(r"(?:^|[\s;&|(])rmdir\b", low) and ("/s" in low or "-recurse" in low):
        return True
    return False


def _is_git_push_force(low: str) -> bool:
    if "git push" not in low:
        return False
    # --force-with-lease 는 안전한 축에 속하므로 허용
    if "--force" in low and "--force-with-lease" not in low:
        return True
    if re.search(r"\s-f(\s|$)", low):
        return True
    return False


def is_dangerous(command: Optional[str]) -> Optional[str]:
    """위험하면 사유 문자열, 안전하면 None."""
    if not command:
        return None
    low = command.lower()

    if _is_rm_recursive_force(low):
        return "rm 재귀+강제 삭제 (대량 파일 삭제 위험)"
    if _is_powershell_remove(low):
        return "Remove-Item 재귀+강제 삭제 (대량 파일 삭제 위험)"
    if _is_git_push_force(low):
        return "git push --force (원격 히스토리 덮어쓰기)"
    if "git reset --hard" in low:
        return "git reset --hard (작업 손실 위험)"
    if re.search(r"git\s+clean\b.*-[a-z]*f", low):
        return "git clean -f (추적되지 않은 파일 삭제)"
    if re.search(r"\bdrop\s+(table|database|schema)\b", low):
        return "SQL DROP (데이터 영구 삭제)"
    if re.search(r"\btruncate\s+table\b", low):
        return "SQL TRUNCATE (데이터 영구 삭제)"
    if re.search(r"\bdd\b[^\n]*\bof=", low):
        return "dd of= (디스크 직접 쓰기)"
    if re.search(r"\bmkfs\b", low):
        return "mkfs (파일시스템 포맷)"
    if re.search(r":\(\)\s*\{\s*:\|", low):
        return "fork bomb"
    return None


def main(stdin: TextIO = None) -> int:
    stdin = stdin or sys.stdin
    # Windows 기본 콘솔 인코딩(cp949)에서 한글 사유가 깨지지 않도록 utf-8 강제.
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass
    try:
        payload = json.load(stdin)
    except Exception:
        # 입력 파싱 실패 시 워크플로우를 막지 않는다 (fail-open).
        return 0

    if not isinstance(payload, dict):
        return 0

    tool_input = payload.get("tool_input") or {}
    command = tool_input.get("command") if isinstance(tool_input, dict) else None

    reason = is_dangerous(command)
    if reason:
        sys.stderr.write(f"BLOCKED: 위험한 명령어가 감지되었습니다 — {reason}\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
