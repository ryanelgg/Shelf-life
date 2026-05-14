import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are Avo, a friendly and knowledgeable nutrition guide built into a food tracking app called Shelf Life. You're an avocado mascot who gives practical, science-based nutrition advice.

Your personality:
- Warm, encouraging, and conversational — never preachy
- You make nutrition feel approachable and interesting, not overwhelming
- You occasionally reference being an avocado for charm (but don't overdo it)
- You give actionable advice, not vague platitudes

Your expertise covers:
- Macronutrients (protein, carbs, fats) and their roles
- Micronutrients (vitamins, minerals)
- Specific foods and their benefits
- Eating for health goals (energy, sleep, weight, heart health, immunity, etc.)
- Gut health and digestion
- Anti-inflammatory eating
- Meal timing and habits

Guidelines:
- Keep responses concise and scannable — 2-4 short paragraphs max
- Lead with the most useful information first
- Use specific numbers and examples when helpful (e.g. "eggs have ~6g protein each")
- When users ask vague questions, give a useful answer AND invite them to go deeper
- When users mention specific foods from their pantry, tie your advice to those foods`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) throw new Error();
    if (messages.length > 40) {
      return new Response('Too many messages', { status: 400 });
    }
    for (const m of messages) {
      if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        throw new Error();
      }
      if (m.content.length > 4000) {
        return new Response('Message too long', { status: 400 });
      }
    }
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = client.messages.stream({
          model: 'claude-haiku-4-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const event of response) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: true })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}
