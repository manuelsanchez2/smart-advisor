"use client"

import { useEffect, useMemo, useState } from "react"
import { useRemoteStorageContext } from "../contexts/RemoteStorageContext"

export default function Home() {
  const {
    remoteStorage,
    isConnected,
    isLoading,
    todos,
    stockItems,
    aiConfig,
    saveAiConfig,
    connect,
    disconnect,
    reload,
  } = useRemoteStorageContext()

  const [question, setQuestion] = useState("")
  const [suggestions, setSuggestions] = useState([])
  const [analysis, setAnalysis] = useState([])
  const [aiAnswer, setAiAnswer] = useState("")
  const [aiError, setAiError] = useState("")
  const [status, setStatus] = useState("")
  const [loginAddress, setLoginAddress] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiForm, setAiForm] = useState({
    endpoint: "",
    apiKey: "",
    llm: "",
    vlm: "",
    sst: "",
    tts: "",
    enabledCapabilities: ["llm", "vlm", "sst", "tts"],
  })

  useEffect(() => {
    if (aiConfig) {
      setAiForm((prev) => ({
        ...prev,
        ...aiConfig,
        enabledCapabilities: aiConfig.enabledCapabilities || prev.enabledCapabilities,
      }))
    }
  }, [aiConfig])

  const handleConnect = () => {
    if (!loginAddress.trim()) {
      setStatus("Please enter your user address (name@host).")
      return
    }
    try {
      connect(loginAddress.trim())
      setStatus("Connecting to RemoteStorage...")
    } catch (error) {
      setStatus(error.message)
    }
  }

  const handleDisconnect = () => {
    disconnect()
    setStatus("Disconnected.")
  }

  const buildContextSummary = () => {
    const todoSummary = (todos || []).slice(0, 8).map((todo) => `- ${todo.text}${todo.todo_item_status ? ` [${todo.todo_item_status}]` : ""}${todo.date ? ` @ ${todo.date}` : ""}`).join("\n")
    const stockSummary = (stockItems || []).slice(0, 8).map((item) => `- ${item.name || item.id} (${item.category || "uncategorized"}): qty ${item.quantity ?? "?"}`).join("\n")
    return [
      "You are Smart Advisor. Use todos (todonna), stock (einkauf), and the user question to propose what to do next.",
      "",
      "Todos snapshot:",
      todoSummary || "- none",
      "",
      "Stock snapshot:",
      stockSummary || "- none",
      "",
      "Generate 3 short, actionable suggestions and be specific about items to buy or tasks to add. Return concise bullet points.",
    ].join("\n")
  }

  const callAiAdvisor = async ({ aiConfig, question, partyTodos, lowStockItems }) => {
    const url = "/api/ai-proxy"
    const endpoint = aiConfig.endpoint?.trim()
    const apiKey = aiConfig.apiKey?.trim()
    if (!endpoint || !apiKey) {
      throw new Error("AI wallet is missing endpoint or API key.")
    }

    const model = aiConfig.llm || "gpt-4o-mini"
    const payload = {
      endpoint,
      apiKey,
      model,
      temperature: 0.5,
      messages: [
        { role: "system", content: buildContextSummary() },
        { role: "user", content: question || "Give me general next steps from my data." },
        {
          role: "user",
          content: `Party-related todos: ${partyTodos.length}. Low stock items: ${lowStockItems.length}.`,
        },
      ],
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`AI endpoint error (${response.status}): ${text}`)
    }

    const data = await response.json()
    const content = data?.text || ""

    return content || "AI returned no content."
  }

  const lowStockItems = useMemo(() => {
    return (stockItems || []).filter(
      (item) => typeof item.quantity === "number" && item.quantity <= 1
    )
  }, [stockItems])

  const partyTodos = useMemo(() => {
    const keywords = ["party", "celebration", "birthday", "gathering", "dinner"]
    return (todos || []).filter((todo) =>
      keywords.some((word) =>
        String(todo.text || "").toLowerCase().includes(word)
      )
    )
  }, [todos])

  const handleGenerate = async () => {
    if (isGenerating) return
    setIsGenerating(true)
    setAiError("")
    setAiAnswer("")
    // Yield to the browser so the "Thinking..." state appears before processing.
    await new Promise((resolve) => setTimeout(resolve, 10))
    const newSuggestions = []
    const questionText = question.trim().toLowerCase()

    if (!isConnected) {
      newSuggestions.push({
        title: "Connect to RemoteStorage",
        detail:
          "Log in to RemoteStorage so I can read todos, stock, and AI wallet settings.",
        source: "connection",
      })
    }

    if (partyTodos.length > 0) {
      const missingSnacks = lowStockItems.length > 0
        ? `Your stock shows ${lowStockItems.length} items running low.`
        : "I could not see any low stock items."
      newSuggestions.push({
        title: "Prep for the upcoming party",
        detail: `${missingSnacks} Consider adding drinks and snacks to your shopping list so guests are covered.`,
        source: "todonna + einkauf",
      })
    }

    if (lowStockItems.length > 0) {
      const names = lowStockItems.slice(0, 4).map((i) => i.name).join(", ")
      newSuggestions.push({
        title: "Restock essentials",
        detail: `You're low on ${names}${lowStockItems.length > 4 ? " and more" : ""}. Add a quick shopping todo to avoid surprises.`,
        source: "einkauf",
      })
    }

    if (questionText.includes("someone") || questionText.includes("home")) {
      newSuggestions.push({
        title: "Welcome-home checklist",
        detail:
          "Make sure essentials are stocked (coffee, snacks, fresh fruit) and tidy up shared spaces.",
        source: "question",
      })
    } else if (questionText.length > 0) {
      newSuggestions.push({
        title: "Address your question",
        detail: `I’ll tailor advice based on "${question}". If you want me to auto-create follow-up todos, keep AI wallet configured.`,
        source: "question",
      })
    }

    if (!aiConfig?.endpoint || !aiConfig?.apiKey) {
      newSuggestions.push({
        title: "Finish AI Wallet setup",
        detail:
          "Add your AI endpoint and API key so I can offload heavy reasoning and later auto-create todos for you.",
        source: "ai-wallet",
      })
    }

    const analysisLog = [
      `Todos scanned: ${todos?.length || 0} (party-related: ${partyTodos.length})`,
      `Stock items scanned: ${stockItems?.length || 0} (low: ${lowStockItems.length})`,
      `AI wallet configured: ${aiConfig?.endpoint ? "yes" : "no"}`,
      question
        ? `Question provided: "${question}"`
        : "No custom question provided",
    ]

    setSuggestions(newSuggestions)
    setAnalysis(analysisLog)

    const shouldUseAi = Boolean(aiConfig?.endpoint && aiConfig?.apiKey)
    if (shouldUseAi) {
      try {
        const aiText = await callAiAdvisor({
          aiConfig,
          question,
          todos,
          partyTodos,
          stockItems,
          lowStockItems,
        })
        setAiAnswer(aiText)
        setStatus("Fresh AI-backed suggestions ready.")
      } catch (error) {
        setAiError(error?.message || "AI advisor failed")
        setStatus("Static suggestions shown. AI call failed.")
      }
    } else {
      setStatus(newSuggestions.length ? "Fresh suggestions ready." : "No suggestions yet. Add a question or data.")
    }

    setIsGenerating(false)
  }

  const handleSaveAiWallet = async () => {
    try {
      await saveAiConfig(aiForm)
      setStatus("AI wallet configuration saved to RemoteStorage.")
    } catch (error) {
      setStatus(error.message)
    }
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Smart Advisor
          </h1>
          <p className="text-gray-600">
            Reads your remote scopes (todos, stock, AI wallet) and proposes what to do next.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-lg bg-white shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">RemoteStorage login</h2>
              <span className="text-sm text-gray-500">
                {isConnected ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Enter your user address and connect, or use the widget in the bottom-right.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="text"
                value={loginAddress}
                onChange={(e) => setLoginAddress(e.target.value)}
                placeholder="you@example.com or user@storage.host"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleConnect}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={isLoading}
                >
                  Login
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Disconnect
                </button>
                <button
                  onClick={reload}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Reload data
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Current user: {remoteStorage?.remote?.userAddress || "not set"}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-lg bg-white shadow">
            <h2 className="text-lg font-semibold">AI Wallet</h2>
            <p className="text-sm text-gray-600">
              Store your AI endpoint and key in RemoteStorage so the advisor can call it later.
            </p>
            <div className="grid grid-cols-1 gap-3 mt-3">
              <input
                type="url"
                value={aiForm.endpoint}
                onChange={(e) => setAiForm({ ...aiForm, endpoint: e.target.value })}
                placeholder="Endpoint (https://...)"
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <input
                type="password"
                value={aiForm.apiKey}
                onChange={(e) => setAiForm({ ...aiForm, apiKey: e.target.value })}
                placeholder="API key"
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={aiForm.llm}
                  onChange={(e) => setAiForm({ ...aiForm, llm: e.target.value })}
                  placeholder="LLM model id"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={aiForm.vlm}
                  onChange={(e) => setAiForm({ ...aiForm, vlm: e.target.value })}
                  placeholder="VLM model id"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleSaveAiWallet}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                disabled={!isConnected}
              >
                Save AI wallet config
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg bg-white shadow space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Smart suggestions</h2>
              <p className="text-sm text-gray-600">
                I’ll scan todonna (todos), einkauf (stock), and your question.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              disabled={isGenerating}
            >
              {isGenerating ? "Thinking..." : "Generate suggestions"}
            </button>
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Ask me something specific (e.g. “Friends coming over Friday, what should I prepare?”)"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <OverviewCard label="Todos (todonna)" value={todos?.length || 0} hint={`${partyTodos.length} party related`} />
            <OverviewCard label="Stock items (einkauf)" value={stockItems?.length || 0} hint={`${lowStockItems.length} low`} />
            <OverviewCard label="AI wallet" value={aiConfig?.endpoint ? "Ready" : "Missing"} hint={aiConfig?.endpoint || "Add endpoint"} />
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((s, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{s.title}</h3>
                    <span className="text-xs text-gray-500">{s.source}</span>
                  </div>
                  <p className="text-gray-700 mt-1">{s.detail}</p>
                </div>
              ))}
            </div>
          )}

          {aiAnswer && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">AI-generated advice</h3>
                <span className="text-xs text-blue-700">ai-wallet → {aiForm.llm || "llm"}</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-gray-800 mt-2">{aiAnswer}</pre>
            </div>
          )}

          {aiError && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50 text-sm text-red-700">
              AI advisor error: {aiError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-2">Process analysis</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                {analysis.map((line, idx) => (
                  <li key={idx}>• {line}</li>
                ))}
                {analysis.length === 0 && (
                  <li className="text-gray-500">Run the advisor to see how it reasons about your data.</li>
                )}
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-2">Follow-up (coming soon)</h3>
              <p className="text-sm text-gray-700">
                Next step: auto-create todos like “Buy snacks” directly in todonna when suggestions call for it.
              </p>
              <button
                className="mt-3 px-4 py-2 bg-gray-200 text-gray-700 rounded-md cursor-not-allowed"
                disabled
              >
                Create shopping todo (soon)
              </button>
            </div>
          </div>
        </div>

        {status && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-800">
            {status}
          </div>
        )}

        {!isConnected && (
          <div className="p-6 rounded-lg bg-white shadow">
            <h2 className="text-lg font-semibold mb-2">How to connect</h2>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li>Enter your user address above and click Login, or use the floating widget.</li>
              <li>Authorize access to todonna, einkauf, and ai-wallet scopes.</li>
              <li>Reload data so the advisor can see your todos and stock.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

function OverviewCard({ label, value, hint }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}
