// Lightweight Groq client using OpenAI-compatible REST API
// Expects Vite env var: VITE_GROQ_API_KEY (do NOT expose server keys in production)

type EmbeddingResponse = {
  data: Array<{ embedding: number[] }>
};

const API_BASE = 'https://api.groq.com/openai/v1';
const EMBEDDINGS_ENDPOINT = `${API_BASE}/embeddings`;
const CHAT_ENDPOINT = `${API_BASE}/chat/completions`;

const getGroqApiKey = (): string => {
  // Vite exposes env vars under import.meta.env
  const key = (import.meta as any).env?.VITE_GROQ_API_KEY as string | undefined;
  if (!key) {
    throw new Error('VITE_GROQ_API_KEY is not set');
  }
  return key;
};

export const embedTexts = async (texts: string[], model = 'text-embedding-3-small'): Promise<number[][]> => {
  if (!texts || texts.length === 0) return [];
  const apiKey = getGroqApiKey();

  const res = await fetch(EMBEDDINGS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: texts
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq embeddings failed: ${res.status} ${res.statusText} ${errText}`);
  }

  const json = (await res.json()) as EmbeddingResponse;
  return json.data.map(d => d.embedding);
};

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export const chatComplete = async (
  messages: ChatMessage[],
  model = 'llama-3.3-70b-versatile',
  temperature = 0.2
): Promise<string> => {
  const apiKey = getGroqApiKey();

  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq chat failed: ${res.status} ${res.statusText} ${errText}`);
  }

  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? '';
  return text;
};


