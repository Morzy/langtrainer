"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { DialogueTurn } from "@/app/api/daily-article/lib/article-generator";

interface Article {
  id: string;
  title: string;
  userRole: string;
}

interface Props {
  article: Article;
  turns: DialogueTurn[];
}

type LineCapture = {
  transcript: string;
  durationSeconds: number;
};

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

export function SpeechPractice({ article, turns }: Props) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Record<number, LineCapture>>({});
  const [interims, setInterims] = useState<Record<number, string>>({});
  const [recordingIdx, setRecordingIdx] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const finalRef = useRef("");
  const pendingTurnIdxRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const stopRecording = useCallback((turnIdx: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    pendingTurnIdxRef.current = turnIdx;
    recognitionRef.current?.stop();
    // Transcript is captured in onend after the browser finalizes any remaining interim speech
    setInterims((prev) => { const n = { ...prev }; delete n[turnIdx]; return n; });
    setRecordingIdx(null);
  }, []);

  const startRecording = useCallback(async (turnIdx: number) => {
    if (recordingIdx !== null) return;

    let sid = sessionId;
    if (!sid) {
      const res = await fetch("/api/practice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });
      const d = await res.json();
      sid = d.sessionId;
      setSessionId(sid);
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError("请使用 Chrome 浏览器"); return; }

    finalRef.current = "";
    startTimeRef.current = Date.now();
    setRecordingIdx(turnIdx);

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recognitionRef.current = rec;

    rec.onresult = (e) => {
      let interim = "";
      let final = finalRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t + " ";
        else interim += t;
      }
      finalRef.current = final;
      setInterims((prev) => ({ ...prev, [turnIdx]: final + interim }));
    };

    rec.onerror = (e) => { if (e.error !== "no-speech") setError(`录音错误: ${e.error}`); };
    rec.onend = () => {
      const pendingIdx = pendingTurnIdxRef.current;
      if (pendingIdx !== null) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const transcript = finalRef.current.trim();
        setCaptures((prev) => ({ ...prev, [pendingIdx]: { transcript, durationSeconds: Math.max(duration, 1) } }));
        pendingTurnIdxRef.current = null;
      }
    };
    rec.start();

    let secs = 10;
    setCountdown(secs);
    timerRef.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) stopRecording(turnIdx);
    }, 1000);
  }, [recordingIdx, sessionId, article.id, stopRecording]);

  const userTurns = turns.filter((t) => t.isUser);
  const doneCount = Object.keys(captures).length;
  const allDone = userTurns.length > 0 && doneCount >= userTurns.length;

  async function handleSubmit() {
    if (!sessionId || !allDone) return;
    setIsSubmitting(true);

    const lines = Object.entries(captures).map(([idx, cap]) => ({
      turnIndex: Number(idx),
      transcript: cap.transcript,
      durationSeconds: cap.durationSeconds,
    }));

    const res = await fetch("/api/practice/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, lines }),
    });
    const data = await res.json();
    router.push(`/practice/result?sessionId=${sessionId}&score=${data.score.totalScore}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">今日对话练习</p>
          <h1 className="text-xl font-bold">{article.title}</h1>
        </div>
        <div className="text-sm text-gray-500">
          已完成 <span className="font-bold text-brand-600">{doneCount}</span> / {userTurns.length} 句
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card bg-blue-50 border-blue-100 text-sm text-blue-700 py-3">
        你扮演 <strong>{article.userRole}</strong>。你的台词以中文显示——请将其翻译成英文并大声说出来。其他角色的台词为英文参考。
      </div>

      <div className="space-y-3">
        {turns.map((turn, idx) => {
          const isUser = turn.isUser;
          const captured = captures[idx];
          const interim = interims[idx];
          const isRecording = recordingIdx === idx;

          return (
            <div key={idx} className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isUser ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-600"
              }`}>
                {turn.speaker[0]}
              </div>

              <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
                <span className="text-xs text-gray-400">{turn.speaker}</span>

                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? "bg-brand-600 text-white rounded-tr-sm"
                    : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                }`}>
                  {turn.text}
                </div>

                {isUser && (
                  <div className="flex items-center gap-2 mt-1">
                    {captured ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-600 font-medium">✓ 已录制</span>
                        <span className="text-xs text-gray-400 italic max-w-48 truncate">
                          &ldquo;{captured.transcript || "（无识别内容）"}&rdquo;
                        </span>
                        <button
                          onClick={() => setCaptures((p) => { const n = { ...p }; delete n[idx]; return n; })}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          重录
                        </button>
                      </div>
                    ) : isRecording ? (
                      <div className="flex items-center gap-2">
                        <span className="animate-pulse text-red-500 text-xs font-medium">
                          ● 录音中 {countdown}s
                        </span>
                        <span className="text-xs text-gray-400 italic max-w-36 truncate">
                          {interim || "等待..."}
                        </span>
                        <button
                          onClick={() => stopRecording(idx)}
                          className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded hover:bg-red-200"
                        >
                          停止
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startRecording(idx)}
                        disabled={recordingIdx !== null && !isRecording}
                        className="text-xs bg-white border border-brand-300 text-brand-700 px-3 py-1 rounded-full hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        🎤 说出翻译
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-4 pt-4">
        <button
          onClick={handleSubmit}
          disabled={!allDone || isSubmitting}
          className="btn-primary w-full"
        >
          {isSubmitting
            ? "评分中..."
            : allDone
            ? "提交评分 →"
            : `还剩 ${userTurns.length - doneCount} 句未完成`}
        </button>
      </div>
    </div>
  );
}
