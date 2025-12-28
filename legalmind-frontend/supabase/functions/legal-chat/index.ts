import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, documentContext } = await req.json();
    const AI_API_KEY = Deno.env.get("AI_API_KEY");
    const AI_API_URL = Deno.env.get("AI_API_URL") || "https://api.openai.com/v1/chat/completions";
    const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4";
    
    if (!AI_API_KEY) {
      throw new Error("AI_API_KEY is not configured. Please set up your AI service API key in Supabase environment variables.");
    }

    const systemPrompt = documentContext 
      ? `You are LegalMind, an AI-powered legal document analysis assistant. You help legal professionals understand, analyze, and identify risks in legal documents.

Current Document Context:
${documentContext}

Guidelines:
- Provide clear, professional legal insights
- Identify potential risks and issues
- Suggest improvements and recommendations
- Use precise legal terminology when appropriate
- Be concise but thorough in your analysis
- If you're unsure about something, acknowledge it
- Never provide definitive legal advice - always recommend consulting with a qualified attorney for important decisions`
      : `You are LegalMind, an AI-powered legal assistant. You help legal professionals with:
- Understanding legal concepts and terminology
- Analyzing contract clauses and provisions
- Identifying potential risks in agreements
- Providing general legal guidance

Guidelines:
- Be professional and precise
- Use clear, accessible language
- Cite relevant legal principles when helpful
- Always recommend consulting with a qualified attorney for important legal decisions
- Be concise but thorough`;

    const response = await fetch(AI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});