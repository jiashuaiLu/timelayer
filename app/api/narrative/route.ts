import { NextResponse } from "next/server";
import { getBlock } from "@/data/blocks";
import {
  buildNarrative,
  buildPolishPrompt,
  groundingIssues,
  narrativeSchema,
} from "@/pipeline/narrative";

export const dynamic = "force-dynamic";

/**
 * M4 — the LLM may only rewrite. The rule engine produces the draft, the model
 * is fenced by a prompt, and every number it emits is checked against the facts
 * before the sentence is allowed out. No key -> the draft is the answer.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { slug?: string; eventId?: string };
  const block = body.slug ? getBlock(body.slug) : undefined;
  const event = block?.events.find((e) => e.id === body.eventId);
  if (!block || !event) {
    return NextResponse.json({ error: "unknown event" }, { status: 404 });
  }

  const draft = buildNarrative(block, event);
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json(draft);
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
        temperature: 0.4,
        max_tokens: 320,
        messages: [
          { role: "system", content: "你是一位克制的城市档案编辑，只做润色，不添加事实。" },
          { role: "user", content: buildPolishPrompt(block, event, draft.text) },
        ],
      }),
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`upstream ${response.status}`);
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("empty completion");

    if (groundingIssues(block, event, text).length) throw new Error("ungrounded year");
    const polished = narrativeSchema.parse({ ...draft, text, polished: true });
    return NextResponse.json(polished);
  } catch {
    return NextResponse.json(draft);
  }
}
