import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { articleId } = await req.json();
  if (!articleId) {
    return NextResponse.json({ error: "articleId required" }, { status: 400 });
  }

  const practiceSession = await prisma.practiceSession.create({
    data: {
      userId: session.user.id,
      articleId,
      status: "in_progress",
    },
  });

  return NextResponse.json({ sessionId: practiceSession.id });
}
