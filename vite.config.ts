import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { AVO_SYSTEM_PROMPT } from './src/lib/avoPrompt'

async function readJsonBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(body))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const groqApiKey = env.GROQ_API_KEY

  return {
    plugins: [
      react(),
      {
        name: 'avo-chat-dev-endpoint',
        configureServer(server) {
          server.middlewares.use('/api/avo-chat', async (request, response) => {
            if (request.method !== 'POST') {
              sendJson(response, 405, { error: 'Method not allowed' })
              return
            }

            if (!groqApiKey) {
              sendJson(response, 500, { error: 'Missing GROQ_API_KEY for local Avo chat' })
              return
            }

            try {
              const body = await readJsonBody(request)
              const messages = body.messages as Array<{ role: string; content: string }> | undefined
              if (!messages || messages.length === 0) {
                sendJson(response, 400, { error: 'No messages provided' })
                return
              }

              const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${groqApiKey}`,
                },
                body: JSON.stringify({
                  model: 'llama-3.3-70b-versatile',
                  max_tokens: 200,
                  messages: [
                    { role: 'system', content: AVO_SYSTEM_PROMPT },
                    ...messages,
                  ],
                }),
              })

              if (!groqResponse.ok) {
                const errorText = await groqResponse.text()
                sendJson(response, groqResponse.status, { error: errorText || 'Groq request failed' })
                return
              }

              const payload = await groqResponse.json() as {
                choices?: Array<{ message?: { content?: string } }>
              }
              const text = payload.choices?.[0]?.message?.content?.trim()
              if (!text) {
                sendJson(response, 502, { error: 'Groq returned an empty response' })
                return
              }

              sendJson(response, 200, { text })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unexpected dev endpoint error'
              sendJson(response, 500, { error: message })
            }
          })
        },
      },
      {
        name: 'receipt-ocr-dev-endpoint',
        configureServer(server) {
          server.middlewares.use('/api/receipt-ocr', async (request, response) => {
            if (request.method !== 'POST') {
              sendJson(response, 405, { error: 'Method not allowed' })
              return
            }

            const anthropicKey = env.VITE_ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY
            if (!anthropicKey) {
              sendJson(response, 500, { error: 'Missing ANTHROPIC_API_KEY for local receipt OCR' })
              return
            }

            try {
              const body = await readJsonBody(request)
              const image = body.image as string | undefined
              if (!image) {
                sendJson(response, 400, { error: 'No image provided' })
                return
              }

              const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': anthropicKey,
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 1024,
                  messages: [{
                    role: 'user',
                    content: [
                      {
                        type: 'image',
                        source: { type: 'base64', media_type: 'image/jpeg', data: image },
                      },
                      {
                        type: 'text',
                        text: 'Extract grocery/food items and prices from this receipt. Return ONLY a JSON array like [{"name":"Milk","price":3.49}]. Skip tax, totals, non-food. If not a receipt, return [].',
                      },
                    ],
                  }],
                }),
              })

              if (!anthropicResponse.ok) {
                const errorText = await anthropicResponse.text()
                sendJson(response, anthropicResponse.status, { error: errorText || 'Anthropic request failed' })
                return
              }

              const result = await anthropicResponse.json() as {
                content?: Array<{ type: string; text?: string }>
              }
              const text = result.content?.find((b: { type: string }) => b.type === 'text')?.text?.trim() ?? '[]'
              const jsonMatch = text.match(/\[[\s\S]*\]/)
              const items = jsonMatch ? JSON.parse(jsonMatch[0]) : []

              sendJson(response, 200, { items })
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unexpected error'
              sendJson(response, 500, { error: message })
            }
          })
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('recharts')) return 'charts'
            if (id.includes('@zxing')) return 'scanner'
            if (id.includes('@supabase') || id.includes('@capacitor')) return 'platform'
            return 'vendor'
          },
        },
      },
    },
  }
})
