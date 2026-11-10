// YT Next Advisor 도메인 타입
// 순수 타입/인터페이스 레이어 — 로직·외부 호출 없음.
// 필드명은 이후 step(2~5)들이 의존하므로 변경하지 않는다.

export interface Channel {
  id: string;
  title: string;
  handle?: string;
  thumbnailUrl?: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  tags: string[];
  viewCount: number;
  publishedAt: string; // ISO8601
}

export interface ChannelAnalysis {
  niche: string; // 한 줄 니치 정의
  topics: string[]; // 자주 다루는 주제/키워드
  format: string; // 포맷 (예: 브이로그, 리뷰, 챌린지)
  tone: string; // 톤/분위기
  targetAudience: string; // 주 타깃
  summary: string; // "넌 이런 채널이다" 한 문단
}

export interface ViralVideo {
  id: string;
  title: string;
  viewCount: number;
  channelTitle: string;
  publishedAt: string;
  whyHot?: string;
}

export interface Recommendation {
  title: string; // 추천 제목안
  angle: string; // 콘텐츠 앵글/후크
  whyTrending: string; // 왜 지금 뜨는가 (ViralVideo 근거)
  whyFitsYou: string; // 왜 당신과 맞는가 (ChannelAnalysis 근거)
}

export interface AnalyzeResult {
  channel: Channel;
  analysis: ChannelAnalysis;
  viral: ViralVideo[];
  recommendations: Recommendation[];
}
