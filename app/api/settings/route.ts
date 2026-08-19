import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { targetLanguage, difficultyLevel, practiceScenarios, dailyGoalMinutes } = body;

  const settings = await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: {
      ...(targetLanguage && { targetLanguage }),
      ...(difficultyLevel && { difficultyLevel }),
      ...(practiceScenarios && { practiceScenarios }),
      ...(dailyGoalMinutes && { dailyGoalMinutes }),
    },
    create: {
      userId: session.user.id,
      targetLanguage: targetLanguage ?? "en",
      difficultyLevel: difficultyLevel ?? "intermediate",
      practiceScenarios: practiceScenarios ?? ["programmer-office"],
      dailyGoalMinutes: dailyGoalMinutes ?? 10,
    },
  });

  return NextResponse.json({ settings });
}
