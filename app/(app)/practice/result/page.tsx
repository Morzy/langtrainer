"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { LineResult } from "@/lib/scoring";

type ScoreData = {
  totalScore: number;
  wordCoverage: number;
  fluencyWpm: number;
  accuracy: number;
  highlightData: LineResult[];
};

type SessionData = {
  status: string;
  durationSeconds: number;
  article: { title: string; userRole: string };
  score: ScoreData;
};

function MiniBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all duration-700"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function ResultPage() {
  const params = useSearchParams();
  const sessionId = params.get("sessionId");
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/practice/result?sessionId=${sessionId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="text-center py-20 text-gray-400">加载结果...</div>;
  if (!data?.score) return (
    <div className="text-center py-20">
      <p className="text-gray-500 mb-4">无法加载结果</p>
      <Link href="/practice" className="btn-primary">重新练习</Link>
    </div>
  );

  const score = data.score;
  const grade =
    score.totalScore >= 90 ? "S" :
    score.totalScore >= 80 ? "A" :
    score.totalScore >= 70 ? "B" :
    score.totalScore >= 60 ? "C" : "D";

  const gradeColor =
    grade === "S" ? "text-yellow-500" :
    grade === "A" ? "text-green-500" :
    grade === "B" ? "text-brand-600" :
    grade === "C" ? "text-orange-500" : "text-red-500";

  const lineResults: LineResult[] = score.highlightData ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Overall score */}
      <div className="card text-center">
        <p className="text-sm text-gray-400 mb-1">{data.article.title}</p>
        <div className={`text-7xl font-black ${gradeColor}`}>{grade}</div>
        <div className="text-4xl font-bold text-gray-800 mt-1">{score.totalScore}</div>
        <p className="text-xs text-gray-400 mt-1">综合评分 / 100</p>
        <div className="mt-4 space-y-2 text-left max-w-xs mx-auto">
          <MiniBar value={score.wordCoverage} label="词汇覆盖" />
          <MiniBar value={score.accuracy} label="准确率" />
          <MiniBar value={Math.min(score.fluencyWpm / 120, 1)} label={`流利度 ${score.fluencyWpm} WPM`} />
        </div>
      </div>

      {/* Per-line breakdown */}
      {lineResults.length > 0 && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-700">逐句详情</h2>
          {lineResults.map((line, i) => (
            <div key={i} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">第 {i + 1} 句</span>
                <span className={`text-sm font-bold ${
                  line.lineScore >= 80 ? "text-green-600" :
                  line.lineScore >= 60 ? "text-brand-600" : "text-orange-500"
                }`}>
                  {line.lineScore} 分
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-1">目标：</p>
              <div className="text-sm leading-loose mb-2">
                {line.highlight.map((w, j) => (
                  <span key={j} className={
                    w.status === "correct" ? "text-green-600 font-medium" : "text-red-400 line-through"
                  }>
                    {w.word}{" "}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-1">你说的：</p>
              <p className="text-sm text-gray-600 italic">
                &ldquo;{line.transcript || "（未识别到内容）"}&rdquo;
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/" className="btn-primary flex-1 text-center">返回首页</Link>
        <Link href="/history" className="btn-secondary flex-1 text-center">查看历史</Link>
      </div>
    </div>
  );
}
