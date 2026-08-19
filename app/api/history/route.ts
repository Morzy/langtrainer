import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await prisma.practiceSession.findMany({
    where: { userId: session.user.id, status: "completed" },
    include: { article: true, score: true },
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ sessions });
}
