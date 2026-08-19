"use client";

import { useEffect, useState } from "react";

const SCENARIOS = [
  { value: "programmer-office", label: "程序员办公室对话" },
  { value: "business-meeting", label: "商务会议" },
  { value: "daily-shopping", label: "日常购物" },
  { value: "travel", label: "旅行场景" },
  { value: "medical", label: "医疗健康" },
  { value: "academic", label: "学术校园" },
];

const DIFFICULTIES = [
  { value: "beginner", label: "初级（约 60 词）" },
  { value: "intermediate", label: "中级（约 120 词）" },
  { value: "advanced", label: "高级（约 220 词）" },
];

const LANGUAGES = [
  { value: "en", label: "英语" },
  { value: "ja", label: "日语" },
  { value: "fr", label: "法语" },
];

const GOALS = [5, 10, 15];

type Settings = {
  targetLanguage: string;
  difficultyLevel: string;
  practiceScenarios: string[];
  dailyGoalMinutes: number;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    targetLanguage: "en",
    difficultyLevel: "intermediate",
    practiceScenarios: ["programmer-office"],
    dailyGoalMinutes: 10,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => { if (d.settings) setSettings(d.settings); });
  }, []);

  function toggleScenario(value: string) {
    setSettings((prev) => ({
      ...prev,
      practiceScenarios: prev.practiceScenarios.includes(value)
        ? prev.practiceScenarios.filter((s) => s !== value)
        : [...prev.practiceScenarios, value],
    }));
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-bold">个人设置</h1>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-700">目标外语</h2>
        <div className="flex gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.value}
              onClick={() => setSettings((p) => ({ ...p, targetLanguage: l.value }))}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                settings.targetLanguage === l.value
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-700">难度级别</h2>
        <div className="space-y-2">
          {DIFFICULTIES.map((d) => (
            <label key={d.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="difficulty"
                value={d.value}
                checked={settings.difficultyLevel === d.value}
                onChange={() => setSettings((p) => ({ ...p, difficultyLevel: d.value }))}
                className="accent-brand-600"
              />
              <span className="text-sm">{d.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-700">练习场景（可多选）</h2>
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map((s) => {
            const selected = settings.practiceScenarios.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggleScenario(s.value)}
                className={`px-3 py-2 rounded-lg border text-sm text-left transition ${
                  selected
                    ? "border-brand-600 bg-brand-50 text-brand-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {selected && <span className="mr-1">✓</span>}
                {s.label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400">每日文章将从已选场景中随机选取</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-700">每日目标时长</h2>
        <div className="flex gap-2">
          {GOALS.map((g) => (
            <button
              key={g}
              onClick={() => setSettings((p) => ({ ...p, dailyGoalMinutes: g }))}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                settings.dailyGoalMinutes === g
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {g} 分钟
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full"
      >
        {saved ? "✓ 已保存" : saving ? "保存中..." : "保存设置"}
      </button>
    </div>
  );
}
