import { createOpenAI } from "@ai-sdk/openai"
import { generateText } from "ai"

export async function POST(request) {
  try {
    const body = await request.json()
    const { endpoint, apiKey, model, messages, temperature = 0.5 } = body || {}

    if (!endpoint || !apiKey || !model || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint, apiKey, model, or messages." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: endpoint,
    })

    const { text } = await generateText({
      model: openai.chat(model),
      messages,
      temperature,
    })

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "AI proxy failed", detail: error?.message || String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
