import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const DIFFICULTY_TURNS: Record<string, number> = {
  beginner: 4,
  intermediate: 6,
  advanced: 8,
};

const SCENARIO_DESCRIPTIONS: Record<string, string> = {
  "programmer-office":
    "software engineers in a tech office, discussing topics like code reviews, debugging, sprint planning, pull requests, or deployment issues",
  "business-meeting":
    "professionals in a business meeting, negotiating, presenting quarterly results, or discussing project timelines",
  "daily-shopping":
    "customers and staff in a shop or market, asking about products, prices, and making purchases",
  travel:
    "travelers at an airport, hotel, or tourist attraction, asking for directions, checking in, or booking tours",
  medical:
    "patients and doctors or pharmacists discussing symptoms, prescriptions, or follow-up appointments",
  academic:
    "students and professors in a classroom or office hour, discussing assignments, research, or academic plans",
};

const DialogueTurnSchema = z.object({
  speaker: z.string().describe("Name of the speaker"),
  text: z
    .string()
    .describe(
      "English text for non-user speakers. Chinese text for the user's turns."
    ),
  isUser: z.boolean().describe("Whether this turn belongs to the learner"),
  targetText: z
    .string()
    .nullable()
    .describe(
      "When isUser=true: the natural English translation the learner should say aloud. Set null for non-user turns."
    ),
});

const DialogueArticleSchema = z.object({
  title: z.string().describe("Short descriptive title in English"),
  userRole: z
    .string()
    .describe("Name of the character the learner plays — always 'You'"),
  turns: z.array(DialogueTurnSchema).describe("Ordered dialogue turns"),
});

export type DialogueTurn = z.infer<typeof DialogueTurnSchema>;
export type DialogueArticle = z.infer<typeof DialogueArticleSchema>;

const model = new ChatOpenAI({
  model: "deepseek-v4-flash-0731",
  configuration: {
    baseURL:
      "https://llm-dciqqfsl0b8yyypt.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  },
  apiKey: process.env.ALIYUN_API_KEY,
  maxTokens: 2048,
  temperature: 0,
});

export async function generateArticle(
  scenario: string,
  difficulty: string,
  _language: string
): Promise<{ dialogue: DialogueArticle; wordCount: number }> {
  const userTurns = DIFFICULTY_TURNS[difficulty] ?? 6;
  const totalTurns = userTurns * 2 + 2;
  const scenarioDesc = SCENARIO_DESCRIPTIONS[scenario] ?? scenario;

  const prompt = `Generate a realistic multi-person dialogue for English oral practice.

Context: ${scenarioDesc}
Difficulty: ${difficulty}
Total turns: approximately ${totalTurns}
User turns: ${userTurns} turns (the character named "You")

Rules:
1. There are 3-4 speakers total. One is always named "You" (the learner's role).
2. For turns spoken by "You": write ONLY Chinese in "text", and write the natural English equivalent in "targetText".
3. For all other speakers: write English in "text". Set "targetText" to null.
4. Keep each turn 2-4 sentences. Natural, conversational language.
5. The dialogue must flow naturally around the given scenario.

Return ONLY a valid JSON object with this exact shape — no markdown, no extra text:
{
  "title": "...",
  "userRole": "You",
  "turns": [
    { "speaker": "...", "text": "...", "isUser": false, "targetText": null },
    { "speaker": "You", "text": "（中文）", "isUser": true, "targetText": "English..." }
  ]
}`;

  const response = await model.invoke(prompt, {response_format: {type: 'json_object'}});
  const raw = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);

  // Strip markdown code fences if the model adds them
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

  const dialogue = DialogueArticleSchema.parse(JSON.parse(jsonText));

  const wordCount = dialogue.turns
    .filter((t: DialogueTurn) => t.isUser && t.targetText)
    .reduce(
      (sum: number, t: DialogueTurn) =>
        sum + (t.targetText?.split(/\s+/).filter(Boolean).length ?? 0),
      0
    );
  return { dialogue, wordCount };
}
