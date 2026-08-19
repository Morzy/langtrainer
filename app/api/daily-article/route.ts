import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { generateArticle } from "@/lib/article-generator";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Return existing assignment for today if present
  const existing = await prisma.dailyAssignment.findUnique({
    where: { userId_assignedDate: { userId, assignedDate: today } },
    include: { article: true },
  });
  if (existing) {
    return NextResponse.json({ article: existing.article });
  }

  // Generate new dialogue article based on user settings
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const scenarios = settings?.practiceScenarios ?? ["programmer-office"];
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  const difficulty = settings?.difficultyLevel ?? "intermediate";
  const language = settings?.targetLanguage ?? "en";

  const { dialogue, wordCount } = await generateArticle(scenario, difficulty, language);

  const article = await prisma.article.create({
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

  await prisma.dailyAssignment.create({
    data: { userId, articleId: article.id, assignedDate: today },
  });

  return NextResponse.json({ article });
}
