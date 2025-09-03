import { embedTexts, chatComplete } from "./groqService";
import type { AnalysisResponse, ClauseAnalysis, MissingClause } from "../types";

// --- Utilities ---
const tryParseJson = <T>(text: string): T | null => {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
};

const chunkText = (text: string, chunkSize = 4000, overlap = 400): string[] => {
  const chunks: string[] = [];
  if (text.length <= chunkSize) {
    return [text];
  }
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
};

// --- Analysis ---
const analyzeChunk = async (
  chunk: string,
  role: string
): Promise<ClauseAnalysis[]> => {
  const roleInstruction = `The user's role is: ${role}. Analyze all clauses from their perspective.`;
  const output = await chatComplete([
    {
      role: "system",
      content:
        "You help people with below-average literacy. Extract only meaningful legal clauses from a text chunk.\n" +
        '- Be conservative: if a clause is standard/neutral, set riskLevel to "Negligible".\n' +
        "- Only assign Low/Medium/High when there is a clear harm or imbalance for the user.\n" +
        "- Use simple words at about a 6th-grade level. Keep it short.\n" +
        '- simplifiedExplanation: 1–2 short sentences in plain language. If helpful, add one tiny example starting with "Example:".\n' +
        '- riskReason (Potential Risk): 1–2 short sentences saying what could go wrong. If helpful, add one tiny example starting with "Example:".\n' +
        "- negotiationSuggestion: 1 short sentence suggesting a safer tweak (or say it is fair).\n" +
        "- suggestedRewrite: a safer, balanced rewrite of clauseText. Keep original meaning where possible. Short and clear.\n" +
        "Return JSON only with a clauses array of objects: { clauseText, simplifiedExplanation, riskLevel in [Low, Medium, High, Negligible], riskReason, negotiationSuggestion, suggestedRewrite }.",
    },
    {
      role: "user",
      content: `${roleInstruction}\n\nTEXT:\n${chunk}\n\nReturn only valid JSON.`,
    },
  ]);
  const parsed = tryParseJson<{ clauses: ClauseAnalysis[] }>(output);
  return parsed?.clauses || [];
};

const synthesizeReport = async (
  clauses: ClauseAnalysis[],
  role: string
): Promise<{
  summary: string;
  keyTerms: any[];
  keyDates: any[];
  missingClauses: MissingClause[];
}> => {
  const roleInstruction = `The user's role is: ${role}. Generate the summary and extract terms/dates from their perspective.`;
  const clauseContext = clauses
    .map(
      (c, i) =>
        `Clause ${i + 1}:\n- Text: "${c.clauseText}"\n- Explanation: "${
          c.simplifiedExplanation
        }"\n- Risk: ${c.riskLevel}\n`
    )
    .join("\n");

  const output = await chatComplete([
    {
      role: "system",
      content:
        "You help laypeople. Use simple, short sentences. Avoid jargon.\n" +
        "- summary: max 4 short sentences in plain language.\n" +
        "- keyTerms: definition in 1 simple sentence each.\n" +
        "- keyDates: description in 1 short sentence each.\n" +
        "- missingClauses: reason in 1 short sentence.\n" +
        "Return JSON only with: summary (string), keyTerms (array of {term, definition}), keyDates (array of {date, description}), missingClauses (array of {clauseName, reason}).",
    },
    {
      role: "user",
      content: `${roleInstruction}\n\nANALYZED CLAUSES:\n${clauseContext}\n\nReturn only valid JSON.`,
    },
  ]);
  const parsed = tryParseJson<{
    summary: string;
    keyTerms: any[];
    keyDates: any[];
    missingClauses: MissingClause[];
  }>(output);
  if (!parsed) throw new Error("Failed to parse synthesis JSON");
  return parsed;
};

export const analyzeContract = async (
  documentText: string,
  role: string,
  onProgress: (message: string) => void
): Promise<AnalysisResponse> => {
  onProgress("Chunking document...");
  const chunks = chunkText(documentText);

  onProgress(`Analyzing ${chunks.length} document section(s)...`);
  const chunkResults = await Promise.all(
    chunks.map((chunk) => analyzeChunk(chunk, role))
  );
  const allClauses = chunkResults.flat();

  if (allClauses.length === 0) {
    throw new Error(
      "No legal clauses were identified in the document. It might be too short or in an unsupported format."
    );
  }

  onProgress("Synthesizing final report...");
  const finalReport = await synthesizeReport(allClauses, role);

  return {
    ...finalReport,
    clauses: allClauses,
  };
};

// --- Vector Retrieval for Impact Simulator ---
const cosineSimilarity = (a: number[], b: number[]): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return dot / denom;
};

const vectorRetrieveRelevantChunks = async (
  chunks: string[],
  query: string,
  topK = 6
): Promise<string[]> => {
  try {
    const inputs = [...chunks, query];
    const vectors = await embedTexts(inputs);
    if (vectors.length !== inputs.length) return chunks;
    const queryVec = vectors[vectors.length - 1];
    const chunkVecs = vectors.slice(0, vectors.length - 1);
    const scored = chunkVecs
      .map((vec, idx) => ({ idx, score: cosineSimilarity(vec, queryVec) }))
      .sort((a, b) => b.score - a.score);
    const selected = scored
      .slice(0, Math.min(topK, scored.length))
      .map((s) => chunks[s.idx]);
    return selected.length > 0 ? selected : chunks;
  } catch {
    return chunks;
  }
};

export const simulateImpact = async (
  documentText: string,
  scenario: string
): Promise<string> => {
  if (!scenario.trim()) return "Please enter a scenario to simulate.";
  const chunks = chunkText(documentText, 1500, 200);
  const relevantChunks = await vectorRetrieveRelevantChunks(
    chunks,
    scenario,
    6
  );
  if (relevantChunks.length === 0) {
    return "Could not find any information in the document relevant to your scenario. Please try rephrasing your question or check if the topic is covered in the contract.";
  }
  const context = relevantChunks.join("\n\n---\n\n");
  const output = await chatComplete(
    [
      {
        role: "system",
        content:
          'You help people with below-average literacy. Answer simply in plain words. Use up to 5 bullet points, each 1–2 short sentences, no jargon. If helpful, include 1 tiny example starting with "Example:".',
      },
      {
        role: "user",
        content: `Scenario: ${scenario}\n\nContract Excerpts:\n${context}\n\nWrite the answer in very simple words. Keep it under 300 words.`,
      },
    ],
    "llama-3.3-70b-versatile",
    0.2
  );
  return output;
};
