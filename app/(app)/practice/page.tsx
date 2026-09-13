"use client";

import { useState, useRef, useEffect } from "react";
import type { DialogueTurn } from "@/app/api/daily-article/lib/article-generator";
import { SpeechPractice } from "./components/SpeechPractice";
import { TypingPractice } from "./components/TypingPractice";

type Article = {
  id: string;
  title: string;
  content: string;
  userRole: string;
  difficulty: string;
  language: string;
};

type PracticeMode = "speech" | "typing";
type PageStatus = "checking" | "idle" | "generating" | "ready";

export default function PracticePage() {
  const [article, setArticle] = useState<Article | null>(null);
  const [turns, setTurns] = useState<DialogueTurn[]>([]);
  const [status, setStatus] = useState<PageStatus>("checking");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<PracticeMode>("speech");
  const checkedRef = useRef(false);

  function applyArticle(a: Article) {
    setArticle(a);
    setTurns(JSON.parse(a.content) as DialogueTurn[]);
    setStatus("ready");
  }

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    fetch("/api/daily-article")
      .then((r) => r.json())
      .then((d) => d.article ? applyArticle(d.article) : setStatus("idle"))
      .catch(() => setStatus("idle"));
  }, []);

  async function generateArticle() {
    setStatus("generating");
    setError("");
    try {
      const r = await fetch("/api/daily-article", { method: "POST" });
      const d = await r.json();
      if (!d.article) { setError("生成失败，请重试"); setStatus("idle"); return; }
      applyArticle(d.article);
    } catch {
      setError("网络错误，请重试");
      setStatus("idle");
    }
  }

  if (status === "checking" || status === "generating") return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      {status === "checking" ? "检查今日文章..." : "生成中，请稍候..."}
    </div>
  );

  if (status === "idle") return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-1">准备好了吗？</p>
        <h1 className="text-2xl font-bold text-gray-800">今日练习</h1>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button onClick={generateArticle} className="btn-primary px-8">
        生成今日文章 →
      </button>
    </div>
  );

  const modeTabs = (
    <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1">
      <button
        onClick={() => setMode("speech")}
        className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
          mode === "speech" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        🎤 口语练习
      </button>
      <button
        onClick={() => setMode("typing")}
        className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
          mode === "typing" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        ⌨️ 打字练习
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {modeTabs}
      {mode === "speech"
        ? <SpeechPractice article={article!} turns={turns} />
        : <TypingPractice article={article!} turns={turns} />
      }
    </div>
  );
}
