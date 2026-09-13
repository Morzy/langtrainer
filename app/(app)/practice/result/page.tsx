"use client";

import { useEffect, useState, useRef } from "react";
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

type ChatMessage = { role: "user" | "coach"; text: string };

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

function CoachPanel({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-load on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      sendMessage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const userText = text?.trim();
    if (userText) setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/practice/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userText }),
      });
      const d = await res.json();
      setMessages((m) => [...m, { role: "coach", text: d.reply ?? "（无回复）" }]);
    } catch {
      setMessages((m) => [...m, { role: "coach", text: "教练暂时离线，请稍后重试。" }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="card border border-gray-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="font-semibold text-gray-700">🤖 AI 教练建议</span>
        <span className="text-gray-400 text-sm">{open ? "收起 ▲" : "展开 ▼"}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {/* Chat history */}
          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed max-w-[85%] ${
                  m.role === "user"
                    ? "bg-brand-600 text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-800 rounded-tl-sm"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-gray-400">
                  <span className="animate-pulse">教练正在思考...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="追问教练..."
              disabled={loading}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => input.trim() && sendMessage(input)}
              disabled={loading || !input.trim()}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-40"
            >
              发送
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            教练会记住你历史上的练习表现（长期记忆）
          </p>
        </div>
      )}
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

      {/* AI Coach */}
      {sessionId && <CoachPanel sessionId={sessionId} />}

      <div className="flex gap-3">
        <Link href="/" className="btn-primary flex-1 text-center">返回首页</Link>
        <Link href="/history" className="btn-secondary flex-1 text-center">查看历史</Link>
      </div>
    </div>
  );
}
