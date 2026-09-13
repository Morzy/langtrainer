import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { ChatOpenAI } from "@langchain/openai";
import { Pool } from "pg";
import { prisma } from "@/lib/db";

// ─── State ────────────────────────────────────────────────────────────────────
//
// messages    → long-term memory (persisted across sessions via PostgresSaver)
// sessionScore → short-term memory (loaded fresh each run, shared between nodes)
// insight      → short-term memory (written by `analyze`, read by `respond`)
//
const CoachState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (existing, incoming) => existing.concat(incoming),
    default: () => [],
  }),
  sessionScore: Annotation<ScoreSummary | null>({
    reducer: (_, b) => (b !== undefined ? b : null),
    default: () => null,
  }),
  insight: Annotation<string>({
    reducer: (_, b) => (b !== undefined ? b : ""),
    default: () => "",
  }),
});

type CoachStateType = typeof CoachState.State;

export type ScoreSummary = {
  totalScore: number;
  wordCoverage: number;
  accuracy: number;
  fluencyWpm: number;
  articleTitle: string;
};

// ─── LLM ──────────────────────────────────────────────────────────────────────

const llm = new ChatOpenAI({
  model: "deepseek-v4-flash-0731",
  configuration: {
    baseURL:
      "https://llm-dciqqfsl0b8yyypt.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  },
  apiKey: process.env.ALIYUN_API_KEY,
  maxTokens: 512,
  temperature: 0.7,
});

// ─── Nodes ────────────────────────────────────────────────────────────────────

// Node 1: load session score from DB
// Short-term memory: puts score data into state for downstream nodes to use.
// Skips if data was already loaded in a prior run (already in checkpoint state).
async function loadContext(
  state: CoachStateType,
  config: { configurable?: { sessionId?: string } }
) {
  if (state.sessionScore) return {}; // already loaded in a previous invocation

  const sessionId = config.configurable?.sessionId;
  if (!sessionId) return {};

  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { score: true, article: { select: { title: true } } },
  });

  if (!session?.score) return {};

  const sessionScore: ScoreSummary = {
    totalScore: session.score.totalScore,
    wordCoverage: session.score.wordCoverage,
    accuracy: session.score.accuracy,
    fluencyWpm: session.score.fluencyWpm,
    articleTitle: session.article.title,
  };

  return { sessionScore };
}

// Node 2: analyze performance
// Short-term memory: reads sessionScore from state (set by loadContext), writes
// a concise insight string that will be passed to the respond node.
// Skips if insight already exists (follow-up messages in the same thread).
async function analyze(state: CoachStateType) {
  if (state.insight) return {}; // already analyzed in a previous invocation
  if (!state.sessionScore) return {};

  const s = state.sessionScore;
  const result = await llm.invoke([
    new HumanMessage(
      `Analyze this English practice session briefly (2-3 sentences, in Chinese):
Article: "${s.articleTitle}"
Score: ${s.totalScore}/100  |  Coverage: ${Math.round(s.wordCoverage * 100)}%  |  Accuracy: ${Math.round(s.accuracy * 100)}%  |  Fluency: ${s.fluencyWpm} WPM
Identify the top 1-2 weak areas and what the learner should focus on.`
    ),
  ]);

  const insight =
    typeof result.content === "string" ? result.content.trim() : "";
  return { insight };
}

// Node 3: generate conversational response
// Uses the full message history (long-term memory from checkpoint) plus the
// current insight (short-term memory from analyze node) to reply.
async function respond(state: CoachStateType) {
  const s = state.sessionScore;
  const systemContent = s
    ? `你是一个友善的外语学习教练。
当前练习：《${s.articleTitle}》，综合评分 ${s.totalScore}/100。
本次分析：${state.insight || "（数据加载中）"}
请用中文回复，语气积极鼓励，给出具体可行的改进建议。不要重复已经说过的内容。`
    : `你是一个友善的外语学习教练。请用中文回复，语气积极鼓励。`;

  const result = await llm.invoke([
    new SystemMessage(systemContent),
    ...state.messages,
  ]);

  return { messages: [result] };
}

// ─── Checkpointer (long-term memory) ─────────────────────────────────────────
//
// PostgresSaver persists the full graph state (messages + insight) to PostgreSQL
// under a thread_id (= userId). The same user's conversation survives across
// multiple practice sessions — the coach remembers prior advice.

let pool: Pool | null = null;
let checkpointer: PostgresSaver | null = null;
let setupDone = false;

async function getCheckpointer(): Promise<PostgresSaver> {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  if (!checkpointer) {
    checkpointer = new PostgresSaver(pool);
  }
  if (!setupDone) {
    await checkpointer.setup(); // creates checkpoint tables on first run
    setupDone = true;
  }
  return checkpointer;
}

// ─── Graph factory ────────────────────────────────────────────────────────────

export async function getCoachGraph() {
  const cp = await getCheckpointer();

  const graph = new StateGraph(CoachState)
    .addNode("loadContext", loadContext)
    .addNode("analyze", analyze)
    .addNode("respond", respond)
    .addEdge(START, "loadContext")
    .addEdge("loadContext", "analyze")
    .addEdge("analyze", "respond")
    .addEdge("respond", END)
    .compile({ checkpointer: cp });

  return graph;
}
