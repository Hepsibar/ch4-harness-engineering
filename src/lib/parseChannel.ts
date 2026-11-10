// 채널 입력 문자열 파싱 (순수 함수 — 네트워크 호출 없음).
// 지원 형식:
//   "@handle"
//   "https://youtube.com/@handle" (경로 뒤 세그먼트 허용)
//   "https://youtube.com/channel/UC..."
//   순수 채널 ID "UC..." (UC + 22자)
//   "@" 없는 bare 문자열 → handle 로 간주
// 해석 불가 시 null.

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

export function parseChannelInput(
  input: string,
): { handle?: string; channelId?: string } | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1) 순수 채널 ID (UC + 22자)
  if (CHANNEL_ID_RE.test(trimmed)) {
    return { channelId: trimmed };
  }

  // 2) youtube.com URL
  if (/youtube\.com/i.test(trimmed)) {
    const channelMatch = trimmed.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
    if (channelMatch) return { channelId: channelMatch[1] };

    const handleMatch = trimmed.match(/\/@([A-Za-z0-9._-]+)/);
    if (handleMatch) return { handle: handleMatch[1] };

    return null;
  }

  // 3) @handle
  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1);
    return handle.length > 0 ? { handle } : null;
  }

  // 4) @ 없는 bare 핸들 (공백 없는 단일 토큰)
  if (/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    return { handle: trimmed };
  }

  return null;
}
