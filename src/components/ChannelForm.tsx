"use client";

// 채널 주소 입력 + '분석' 버튼. 제출 시 상위로 콜백한다.
// 자체 상태(입력값)는 page 가 들고, 여기서는 제어 컴포넌트로 받아 표시만 한다.

interface ChannelFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export default function ChannelForm({
  value,
  onChange,
  onSubmit,
  loading,
}: ChannelFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="채널 핸들·URL·ID (예: @mychannel)"
        aria-label="채널 주소"
        disabled={loading}
        className="flex-1 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={loading || value.trim() === ""}
        className="rounded-md bg-red-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "분석 중…" : "분석"}
      </button>
    </form>
  );
}
