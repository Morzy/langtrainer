export type WordMatch = {
  word: string;
  status: "correct" | "missed" | "extra";
};

export type LineResult = {
  turnIndex: number;
  targetText: string;
  transcript: string;
  wordCoverage: number;
  accuracy: number;
  fluencyWpm: number;
  lineScore: number;
  highlight: WordMatch[];
};

function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function normalizedSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - levenshtein(a, b) / maxLen;
}

export function scoreDialogueLine(
  targetText: string,
  transcript: string,
  durationSeconds: number
): LineResult {
  const targetWords = targetText.split(/\s+/).map(normalizeWord).filter(Boolean);
  const transcriptWords = transcript.split(/\s+/).map(normalizeWord).filter(Boolean);

  const targetSet = new Set(targetWords);
  const transcriptSet = new Set(transcriptWords);

  const covered = [...targetSet].filter((w) => transcriptSet.has(w)).length;
  const wordCoverage = targetSet.size > 0 ? covered / targetSet.size : 0;

  const accuracy = normalizedSimilarity(
    targetWords.join(" "),
    transcriptWords.join(" ")
  );

  const minutes = Math.max(durationSeconds / 60, 0.05);
  const fluencyWpm = Math.round(transcriptWords.length / minutes);
  const fluencyNorm = Math.min(fluencyWpm / 120, 1);

  const lineScore = Math.round(
    (wordCoverage * 0.4 + accuracy * 0.4 + fluencyNorm * 0.2) * 100
  );

  const highlight: WordMatch[] = targetWords.map((word) => ({
    word,
    status: transcriptSet.has(word) ? "correct" : "missed",
  }));

  return {
    turnIndex: -1, // set by caller
    targetText,
    transcript,
    wordCoverage,
    accuracy,
    fluencyWpm,
    lineScore,
    highlight,
  };
}

export function aggregateScore(lineResults: LineResult[]) {
  if (lineResults.length === 0) {
    return { wordCoverage: 0, fluencyWpm: 0, accuracy: 0, totalScore: 0 };
  }
  const avg = (fn: (r: LineResult) => number) =>
    lineResults.reduce((s, r) => s + fn(r), 0) / lineResults.length;

  return {
    wordCoverage: avg((r) => r.wordCoverage),
    fluencyWpm: Math.round(avg((r) => r.fluencyWpm)),
    accuracy: avg((r) => r.accuracy),
    totalScore: Math.round(avg((r) => r.lineScore)),
  };
}
