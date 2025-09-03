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
        "You are an expert legal AI assistant. Extract and analyze only meaningful legal clauses from a text chunk.\n" +
        '- Be conservative: if a clause is standard/neutral, set riskLevel to "Negligible".\n' +
        "- Only assign Low/Medium/High when there is a concrete, non-ambiguous harm or imbalance for the user, with a clear mechanism (what, how, consequence).\n" +
        '- Do NOT invent risks. If uncertain, prefer "Negligible".\n' +
        "- Explanations must be brief and plain-English, focusing on what it means for the user.\n" +
        "- negotiationSuggestion should be a short, practical wording change (or say it is fair as-is).\n" +
        "Return JSON only with a clauses array of objects: { clauseText, simplifiedExplanation, riskLevel in [Low, Medium, High, Negligible], riskReason, negotiationSuggestion }.",
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
        "You are an expert legal AI assistant. Synthesize a high-level report from pre-analyzed legal clauses.\n" +
        "- Keep the summary concise and practical.\n" +
        "- If most clauses are standard with negligible risk, explicitly note that overall risk appears low and typical.\n" +
        '- Only list "missingClauses" if commonly expected for the inferred contract type; avoid over-flagging.\n' +
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
          "You are an expert legal AI assistant. Given contract excerpts and a hypothetical scenario, explain likely legal and financial consequences in clear, step-by-step language for a non-lawyer.",
      },
      {
        role: "user",
        content: `Scenario: ${scenario}\n\nContract Excerpts:\n${context}`,
      },
    ],
    "llama-3.3-70b-versatile",
    0.2
  );
  return output;
};
