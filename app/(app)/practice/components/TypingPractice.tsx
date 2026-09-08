"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DialogueTurn } from "@/app/api/daily-article/lib/article-generator";
import { PhoneticHints } from "./PhoneticHints";

interface Article {
  id: string;
  title: string;
  difficulty: string;
  language: string;
}

interface Props {
  article: Article;
  turns: DialogueTurn[];
}

function getTargetText(turn: DialogueTurn): string {
  return turn.isUser ? (turn.targetText ?? turn.text) : turn.text;
}

function CharComparison({ original, typed }: { original: string; typed: string }) {
  return (
    <>
      {original.split("").map((ch, i) => {
        const typedCh = typed[i];
        let cls = "text-gray-300";
        if (typedCh !== undefined) {
          cls = typedCh === ch ? "text-green-600" : "bg-red-100 text-red-600";
        }
        return (
          <span key={i} className={cls}>
            {ch}
          </span>
        );
      })}
      {/* Extra characters typed beyond original length */}
      {typed.length > original.length && (
        <span className="bg-red-200 text-red-700">{typed.slice(original.length)}</span>
      )}
    </>
  );
}

export function TypingPractice({ article, turns }: Props) {
  const router = useRouter();
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [lineInputs, setLineInputs] = useState<string[]>(() => Array(turns.length).fill(""));
  const [isFinished, setIsFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionInitRef = useRef(false);
  const lineStartTimeRef = useRef(Date.now());
  const lineDurationsRef = useRef<number[]>(Array(turns.length).fill(0));

  const isLowDifficulty = article.difficulty === "beginner";

  useEffect(() => {
    if (hasStarted && !isFinished) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasStarted, isFinished]);

  useEffect(() => {
    if (!isFinished) {
      textareaRef.current?.focus();
      lineStartTimeRef.current = Date.now();
    }
  }, [currentLineIndex, isFinished]);

  const initSession = useCallback(async () => {
    if (sessionInitRef.current) return;
    sessionInitRef.current = true;
    try {
      const res = await fetch("/api/practice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });
      const d = await res.json();
      setSessionId(d.sessionId);
    } catch {
      // Non-fatal — submit will fail gracefully with its own error
    }
  }, [article.id]);

  function handleInput(value: string) {
    if (isFinished) return;
    if (!hasStarted) {
      setHasStarted(true);
      initSession();
    }
    const newInputs = [...lineInputs];
    newInputs[currentLineIndex] = value;
    setLineInputs(newInputs);
  }

  function advanceLine() {
    const now = Date.now();
    lineDurationsRef.current[currentLineIndex] = Math.max(
      1,
      Math.round((now - lineStartTimeRef.current) / 1000)
    );
    const next = currentLineIndex + 1;
    if (next >= turns.length) {
      setIsFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      setCurrentLineIndex(next);
    }
  }

  // Auto-advance when the user has typed as many characters as the current line
  useEffect(() => {
    if (isFinished || !hasStarted) return;
    const target = getTargetText(turns[currentLineIndex]);
    const typed = lineInputs[currentLineIndex];
    if (typed.length > 0 && typed === target) {
      const t = setTimeout(advanceLine, 300);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineInputs, currentLineIndex, isFinished, hasStarted]);

  async function handleSubmit() {
    if (isSubmitting) return;
    if (!sessionId) {
      setSubmitError("会话未就绪，请稍后重试");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");

    const lines = turns
      .map((turn, idx) => ({ turn, idx }))
      .filter(({ turn }) => turn.isUser)
      .map(({ idx }) => ({
        turnIndex: idx,
        transcript: lineInputs[idx],
        durationSeconds: lineDurationsRef.current[idx] || Math.max(1, Math.round(elapsed / turns.length)),
      }));

    try {
      const res = await fetch("/api/practice/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, lines }),
      });
      const data = await res.json();
      router.push(`/practice/result?sessionId=${sessionId}&score=${data.score.totalScore}`);
    } catch {
      setSubmitError("提交失败，请重试");
      setIsSubmitting(false);
    }
  }

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">打字练习</p>
          <h1 className="text-xl font-bold">{article.title}</h1>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-bold text-gray-700">{formatTime(elapsed)}</div>
          <div className="text-xs text-gray-400">
            {currentLineIndex + (isFinished ? 0 : 0)} / {turns.length} 行
          </div>
        </div>
      </div>

      <div className="card bg-blue-50 border-blue-100 text-sm text-blue-700 py-3">
        逐行输入原文，输完当前行自动跳到下一行。
        {isLowDifficulty && " 低难度模式已开启键位提示。"}
      </div>

      {/* Lines */}
      <div className="space-y-3">
        {turns.map((turn, idx) => {
          const targetText = getTargetText(turn);
          const typed = lineInputs[idx];
          const isPast = idx < currentLineIndex || isFinished;
          const isCurrent = idx === currentLineIndex && !isFinished;
          const isFuture = !isPast && !isCurrent;

          return (
            <div
              key={idx}
              className={`rounded-xl p-4 border transition-all duration-150 ${
                isCurrent
                  ? "border-brand-400 bg-white shadow-md ring-2 ring-brand-100"
                  : isPast
                  ? "border-gray-100 bg-gray-50"
                  : "border-gray-100 bg-white opacity-40"
              }`}
            >
              {/* Speaker label */}
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold uppercase tracking-wide ${
                  turn.isUser ? "text-brand-600" : "text-gray-400"
                }`}>
                  {turn.speaker}
                </span>
                {isPast && (
                  <span className="text-xs text-gray-300">
                    ✓ {lineDurationsRef.current[idx]}s
                  </span>
                )}
              </div>

              {/* Original text with character comparison */}
              <div className="font-mono text-sm leading-relaxed break-words">
                {(isCurrent || isPast) ? (
                  <CharComparison original={targetText} typed={typed} />
                ) : (
                  <span className="text-gray-400">{targetText}</span>
                )}
              </div>

              {/* Keyboard hints for low difficulty (current + upcoming lines) */}
              {isLowDifficulty && !isPast && (
                <PhoneticHints text={targetText} language={article.language} />
              )}

              {/* Input area — only for the active line */}
              {isCurrent && (
                <textarea
                  ref={textareaRef}
                  value={typed}
                  onChange={(e) => handleInput(e.target.value)}
                  placeholder="在此输入，输完本行自动跳下一行..."
                  rows={2}
                  className="mt-3 w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono placeholder-gray-300 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-200"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Submit button after all lines done */}
      {isFinished && (
        <div className="sticky bottom-4 pt-2">
          {submitError && (
            <p className="text-sm text-red-600 mb-2 text-center">{submitError}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !sessionId}
            className="btn-primary w-full"
          >
            {isSubmitting
              ? "评分中..."
              : !sessionId
              ? "准备中..."
              : `提交评分 · 用时 ${formatTime(elapsed)} →`}
          </button>
        </div>
      )}
    </div>
  );
}
