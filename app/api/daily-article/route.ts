import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateArticle } from "@/app/api/daily-article/lib/article-generator";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

const LOCK_RETRY_MS = 3000;
const LOCK_MAX_RETRIES = 4;

async function waitForArticle(userId: string, today: Date) {
  for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
    await new Promise((r) => setTimeout(r, LOCK_RETRY_MS));
    const assignment = await prisma.dailyAssignment.findUnique({
      where: { userId_assignedDate: { userId, assignedDate: today } },
      include: { article: true },
    });
    if (assignment) return assignment.article;
  }
  return null;
}

function todayDate() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Read-only: returns today's article if it exists, null otherwise
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignment = await prisma.dailyAssignment.findUnique({
    where: { userId_assignedDate: { userId: session.user.id, assignedDate: todayDate() } },
    include: { article: true },
  });

  return NextResponse.json({ article: assignment?.article ?? null });
}

// Triggers generation of today's article (idempotent via distributed lock)
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = todayDate();

  // Fast path: already generated today
  const existing = await prisma.dailyAssignment.findUnique({
    where: { userId_assignedDate: { userId, assignedDate: today } },
    include: { article: true },
  });
  if (existing) {
    return NextResponse.json({ article: existing.article });
  }

  // Acquire distributed lock via unique insert
  try {
    await prisma.generationLock.create({
      data: { userId, lockDate: today },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const article = await waitForArticle(userId, today);
      if (article) return NextResponse.json({ article });
      return NextResponse.json({ error: "Generation timed out, please retry" }, { status: 503 });
    }
    throw e;
  }

  // Lock acquired — generate and persist
  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const scenarios = settings?.practiceScenarios ?? ["programmer-office"];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    const difficulty = settings?.difficultyLevel ?? "intermediate";
    const language = settings?.targetLanguage ?? "en";

    const { dialogue, wordCount } = await generateArticle(scenario, difficulty, language);

    const article = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          title: dialogue.title,
          content: JSON.stringify(dialogue.turns),
          userRole: dialogue.userRole,
          language,
          difficulty,
          scenario,
          wordCount,
        },
      });
      await tx.dailyAssignment.create({
        data: { userId, articleId: created.id, assignedDate: today },
      });
      return created;
    });

    return NextResponse.json({ article });
  } catch (e) {
    await prisma.generationLock.deleteMany({ where: { userId, lockDate: today } });
    throw e;
  }
}
