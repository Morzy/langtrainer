"use client";

import { useEffect, useState } from "react";

type Session = {
  id: string;
  startedAt: string;
  durationSeconds: number;
  article: { title: string; scenario: string; difficulty: string };
  score: { totalScore: number; wordCoverage: number; fluencyWpm: number; accuracy: number } | null;
};

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
};

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => { setSessions(d.sessions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-gray-400">加载历史记录...</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        还没有练习记录，去完成今日练习吧！
      </div>
    );
  }

  const streak = sessions.reduce((acc, s, i) => {
    if (i === 0) return 1;
    const d1 = new Date(sessions[i - 1].startedAt);
    const d2 = new Date(s.startedAt);
    const diff = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 1 ? acc + 1 : acc;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">练习历史</h1>
        <div className="card py-2 px-4 text-center">
          <div className="text-2xl font-bold text-brand-600">{streak}</div>
          <div className="text-xs text-gray-400">连续天数</div>
        </div>
      </div>

      <div className="space-y-3">
        {sessions.map((s) => (
          <div key={s.id} className="card flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{s.article.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(s.startedAt).toLocaleDateString("zh-CN")} ·{" "}
                {DIFFICULTY_LABEL[s.article.difficulty] ?? s.article.difficulty} ·{" "}
                {s.durationSeconds}秒
              </p>
            </div>
            {s.score ? (
              <div className="text-right shrink-0">
                <div
                  className={`text-2xl font-bold ${
                    s.score.totalScore >= 80
                      ? "text-green-600"
                      : s.score.totalScore >= 60
                      ? "text-brand-600"
                      : "text-orange-500"
                  }`}
                >
                  {s.score.totalScore}
                </div>
                <div className="text-xs text-gray-400">{s.score.fluencyWpm} WPM</div>
              </div>
            ) : (
              <span className="text-xs text-gray-300">无评分</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
