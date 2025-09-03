# UnBind – AI Legal Contract Analyzer (Groq + RAG)

UnBind is a lightweight, client-side web app that analyzes legal contracts using Retrieval-Augmented Generation (RAG) with Groq. It extracts clauses, explains risks in plain English, identifies key terms/dates, and runs scenario simulations grounded in the actual document text.

## Features

- Document upload: PDF and plain text
- Clause extraction with simplified explanations
- Conservative risk labels (Negligible / Low / Medium / High)
- Missing-clause suggestions by contract type
- Key terms and key dates extraction
- Impact Simulator: scenario Q&A grounded by vector retrieval
- Analysis history stored locally (no backend)

## Tech stack

- Vite + React + TypeScript
- Groq (chat completions + OpenAI-compatible embeddings)
- Client-side vector retrieval (cosine similarity)

## Quick start

1. Create an env file in the project root:

Path: ./.env.local

```bash
VITE_GROQ_API_KEY=your_groq_key
```

2. Install and run

```bash
npm install
npm run dev
```

Open the printed URL (typically http://localhost:5173).

## How it works (RAG)

1. Extract text (PDF via pdf.js, or plain text).
2. Chunk the document with overlap.
3. Compute embeddings (Groq OpenAI-compatible embeddings) and retrieve top-k relevant chunks for queries.
4. Use Groq chat completions to: a) extract clause analyses, b) synthesize a report, c) answer scenario questions with retrieved context.

## Environment

- The app runs fully client-side. Do not commit your real key; use `.env.local`.
- For production, consider moving LLM/embeddings behind a server to protect keys and add rate limiting.

## Notes on risk labeling

Prompts are tuned to be conservative and avoid false positives. Standard/neutral clauses default to “Negligible.” Risks should cite a concrete mechanism and consequence.

## Roadmap ideas

- Hide “Negligible” risks toggle and sensitivity control
- Redline generator for risky clauses
- Multi-document comparison and policy checks
- PDF export with highlighted clauses

## License

For hackathon/demo use. Replace with your preferred license if needed.
