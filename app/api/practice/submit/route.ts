import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { scoreDialogueLine, aggregateScore, LineResult } from "@/lib/scoring";
import { DialogueTurn } from "@/app/api/daily-article/lib/article-generator";
import { NextRequest, NextResponse } from "next/server";

type LineSubmission = {
  turnIndex: number;
  transcript: string;
  durationSeconds: number;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, lines } = (await req.json()) as {
    sessionId: string;
    lines: LineSubmission[];
  };

  if (!sessionId || !lines?.length) {
    return NextResponse.json({ error: "sessionId and lines required" }, { status: 400 });
  }

  const practiceSession = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { article: true },
  });

  if (!practiceSession || practiceSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const turns: DialogueTurn[] = JSON.parse(practiceSession.article.content);

  const lineResults: LineResult[] = lines.map((line) => {
    const turn = turns[line.turnIndex];
    const result = scoreDialogueLine(
      turn.targetText ?? "",
      line.transcript,
      line.durationSeconds
    );
    return { ...result, turnIndex: line.turnIndex };
  });

  const aggregated = aggregateScore(lineResults);
  const totalDuration = lines.reduce((s, l) => s + l.durationSeconds, 0);

  const [, score] = await prisma.$transaction([
    prisma.practiceSession.update({
      where: { id: sessionId },
      data: {
        transcribedText: JSON.stringify(lineResults),
        durationSeconds: totalDuration,
        completedAt: new Date(),
        status: "completed",
      },
    }),
    prisma.score.create({
      data: {
        sessionId,
        wordCoverage: aggregated.wordCoverage,
        fluencyWpm: aggregated.fluencyWpm,
        accuracy: aggregated.accuracy,
        totalScore: aggregated.totalScore,
        highlightData: lineResults as unknown as object,
      },
    }),
  ]);

  return NextResponse.json({ score, lineResults });
}
