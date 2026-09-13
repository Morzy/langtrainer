import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { getCoachGraph } from "./graph";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, message } = await req.json() as {
    sessionId: string;
    message?: string;
  };

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const userMessage = message?.trim() || "请分析我刚才的练习表现，给我一些改进建议。";
  const threadId = session.user.id; // long-term memory: one thread per user

  try {
    const graph = await getCoachGraph();

    const result = await graph.invoke(
      { messages: [new HumanMessage(userMessage)] },
      {
        configurable: {
          thread_id: threadId,
          sessionId, // passed to loadContext node
        },
      }
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const reply =
      typeof lastMessage?.content === "string"
        ? lastMessage.content
        : "（教练暂时无法回复）";

    return NextResponse.json({ reply, threadId });
  } catch (e) {
    console.error("[coach]", e);
    return NextResponse.json(
      { error: "Coach unavailable, please try again" },
      { status: 500 }
    );
  }
}
