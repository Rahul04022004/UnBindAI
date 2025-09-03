import { embedTexts, chatComplete } from "./groqService";
import type { AnalysisResponse, ClauseAnalysis, MissingClause, ChunkSummary, RiskLevel } from "../types";
import { processPdfText } from "./pdfProcessingService";
import { convertPdfToMarkdown } from "./pdfToMarkdownService";

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

/**
 * Advanced semantic text chunking function that respects document structure
 * Splits text by semantic boundaries (paragraphs, headings) before applying size limits
 */
const chunkText = (text: string, chunkSize = 4000, overlap = 300): string[] => {
  // Early return for small texts
  if (text.length <= chunkSize) {
    return [text];
  }

  // Step 1: Normalize whitespace and clean up the text
  const normalizedText = text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\r/g, '\n')             // Handle old Mac line endings
    .replace(/\n{3,}/g, '\n\n')       // Collapse multiple newlines to double newlines
    .replace(/[ \t]+/g, ' ')          // Normalize spaces and tabs
    .trim();

  // Step 2: Split into semantic sections (paragraphs, headings, lists)
  const sections = splitIntoSemanticSections(normalizedText);
  
  // Step 3: Group sections into chunks respecting size limits
  const chunks = groupSectionsIntoChunks(sections, chunkSize, overlap);
  
  return chunks;
};

/**
 * Splits text into semantic sections based on document structure
 */
const splitIntoSemanticSections = (text: string): string[] => {
  const sections: string[] = [];
  
  // Split by double newlines (paragraph boundaries)
  const paragraphs = text.split(/\n\s*\n/);
  
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    
    // Check if this looks like a heading (short line, possibly numbered, all caps, etc.)
    if (isLikelyHeading(trimmed)) {
      sections.push(trimmed);
    } else {
      // For regular paragraphs, check if they contain lists or tables
      const subSections = splitParagraphIntoSections(trimmed);
      sections.push(...subSections);
    }
  }
  
  return sections;
};

/**
 * Determines if a text segment is likely a heading
 */
const isLikelyHeading = (text: string): boolean => {
  const lines = text.split('\n');
  if (lines.length > 3) return false; // Headings are typically short
  
  const firstLine = lines[0].trim();
  
  // Check various heading patterns
  return (
    // Numbered sections (1., 1.1, 1.1.1, etc.)
    /^\d+(\.\d+)*\.?\s/.test(firstLine) ||
    // Roman numerals (I., II., III., etc.)
    /^[IVX]+\.?\s/.test(firstLine) ||
    // Lettered sections (A., B., C., etc.)
    /^[A-Z]\.?\s/.test(firstLine) ||
    // All caps (but not too long)
    (firstLine === firstLine.toUpperCase() && firstLine.length < 100 && firstLine.length > 3) ||
    // Common heading keywords
    /^(section|chapter|part|article|clause|schedule|appendix|exhibit)\s+\d+/i.test(firstLine) ||
    // Short lines that end with colon
    (firstLine.length < 80 && firstLine.endsWith(':')) ||
    // Lines that are significantly shorter than average paragraph length
    (firstLine.length < 60 && lines.length === 1)
  );
};

/**
 * Splits a paragraph into smaller sections if it contains lists, tables, or is too long
 */
const splitParagraphIntoSections = (paragraph: string): string[] => {
  const sections: string[] = [];
  const lines = paragraph.split('\n');
  
  // Check for list patterns
  const listPatterns = [
    /^\s*[-•*]\s/,           // Bullet points
    /^\s*\d+\.\s/,           // Numbered lists
    /^\s*[a-z]\)\s/,         // Lettered lists
    /^\s*\([a-z]\)\s/,       // Parenthesized letters
  ];
  
  let currentSection: string[] = [];
  
  for (const line of lines) {
    const isListItem = listPatterns.some(pattern => pattern.test(line));
    
    if (isListItem) {
      // If we have accumulated content, save it as a section
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
        currentSection = [];
      }
      currentSection.push(line);
    } else {
      currentSection.push(line);
    }
  }
  
  // Add any remaining content
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }
  
  return sections;
};

/**
 * Groups semantic sections into chunks while respecting size limits and maintaining overlap
 */
const groupSectionsIntoChunks = (sections: string[], chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentSize = 0;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionSize = section.length;
    
    // If adding this section would exceed chunk size
    if (currentSize + sectionSize > chunkSize && currentChunk) {
      // Save current chunk
      chunks.push(currentChunk.trim());
      
      // Start new chunk with overlap from previous chunk
      const overlapText = getOverlapText(currentChunk, overlap);
      currentChunk = overlapText + (overlapText ? '\n\n' : '') + section;
      currentSize = currentChunk.length;
    } else {
      // Add section to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + section;
      } else {
        currentChunk = section;
      }
      currentSize = currentChunk.length;
    }
    
    // If a single section is too large, split it further
    if (sectionSize > chunkSize) {
      const subChunks = splitLargeSection(section, chunkSize, overlap);
      // Replace the current chunk with the first sub-chunk
      currentChunk = subChunks[0];
      currentSize = currentChunk.length;
      
      // Add remaining sub-chunks
      for (let j = 1; j < subChunks.length; j++) {
        chunks.push(subChunks[j]);
      }
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

/**
 * Extracts overlap text from the end of a chunk
 */
const getOverlapText = (text: string, overlapSize: number): string => {
  if (text.length <= overlapSize) return text;
  
  // Try to find a good break point within the overlap area
  const overlapArea = text.slice(-overlapSize * 1.5); // Look in a slightly larger area
  const lastSentence = overlapArea.match(/[.!?]\s+[A-Z]/);
  
  if (lastSentence) {
    const sentenceEnd = text.lastIndexOf(lastSentence[0]) + 1;
    return text.slice(sentenceEnd).trim();
  }
  
  // Fallback: just take the last overlapSize characters
  return text.slice(-overlapSize);
};

/**
 * Splits a large section into smaller chunks with overlap
 */
const splitLargeSection = (section: string, chunkSize: number, overlap: number): string[] => {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < section.length) {
    let end = start + chunkSize;
    
    // Try to find a good break point near the end
    if (end < section.length) {
      const searchArea = section.slice(start + chunkSize - overlap, end + overlap);
      const breakPoints = [
        searchArea.lastIndexOf('\n\n'),  // Paragraph break
        searchArea.lastIndexOf('\n'),    // Line break
        searchArea.lastIndexOf('. '),    // Sentence break
        searchArea.lastIndexOf(', '),    // Clause break
      ].filter(pos => pos !== -1);
      
      if (breakPoints.length > 0) {
        const bestBreak = Math.max(...breakPoints);
        end = start + chunkSize - overlap + bestBreak;
      }
    }
    
    const chunk = section.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    
    start = end - overlap; // Apply overlap
  }
  
  return chunks;
};

// --- Analysis ---
const analyzeChunk = async (
  chunk: string,
  role: string
): Promise<ClauseAnalysis[]> => {
  const roleInstruction = `The user's role is: ${role}. Analyze ALL content in this chunk from their perspective.`;
  const output = await chatComplete([
    {
      role: "system",
      content:
        "You help people with below-average literacy. You MUST analyze EVERY piece of content in the text chunk.\n" +
        "IMPORTANT: Do not skip any content. Every section, paragraph, or clause must be analyzed and included in your response.\n" +
        "\n" +
        "For each piece of content:\n" +
        "- If it's a standard/neutral clause with NO risk at all, set riskLevel to 'No Risk' and provide only a summary explanation\n" +
        "- If it's a standard clause with minimal risk, set riskLevel to 'Negligible' and provide full explanation\n" +
        "- If there's potential harm or imbalance, assign Low/Medium/High risk levels\n" +
        "- Use simple words at about a 6th-grade level. Keep explanations clear and helpful\n" +
        "\n" +
        "Required fields for each clause:\n" +
        "- clauseText: The actual text being analyzed (can be a sentence, paragraph, or section)\n" +
        "- simplifiedExplanation: 1–2 sentences explaining what this means in plain language\n" +
        "- riskLevel: One of [Low, Medium, High, Negligible, No Risk]\n" +
        "- riskReason: For No Risk, just say 'No risk identified'. For other risks, explain what could go wrong.\n" +
        "- negotiationSuggestion: For No Risk, say 'No changes needed'. For other risks, suggest improvements.\n" +
        "- suggestedRewrite: For No Risk, say 'No changes needed'. For other risks, provide a safer version.\n" +
        "\n" +
        "Return JSON only with a clauses array. Make sure to cover ALL content in the chunk, not just risky parts.",
    },
    {
      role: "user",
      content: `${roleInstruction}\n\nTEXT CHUNK TO ANALYZE:\n${chunk}\n\nAnalyze EVERY part of this text and return JSON with all clauses found.`,
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
  chunkSummaries: any[];
}> => {
  const roleInstruction = `The user's role is: ${role}. Generate a comprehensive summary and extract all relevant information from their perspective.`;
  
  // Separate clauses by risk level for better analysis
  const negligibleClauses = clauses.filter(c => c.riskLevel === 'Negligible');
  const riskClauses = clauses.filter(c => c.riskLevel !== 'Negligible');
  
  const clauseContext = clauses
    .map(
      (c, i) =>
        `Clause ${i + 1}:\n- Text: "${c.clauseText}"\n- Explanation: "${
          c.simplifiedExplanation
        }"\n- Risk: ${c.riskLevel}\n- Risk Reason: "${c.riskReason}"\n`
    )
    .join("\n");

  const output = await chatComplete([
    {
      role: "system",
      content:
        "You help laypeople. Use simple, short sentences. Avoid jargon.\n" +
        "IMPORTANT: This document has been fully analyzed. Include information about ALL clauses, not just risky ones.\n" +
        "\n" +
        "Required fields:\n" +
        "- summary: 4-6 short sentences covering the overall document, including both safe and risky clauses\n" +
        "- keyTerms: Extract important legal/business terms with simple definitions (1 sentence each)\n" +
        "- keyDates: Extract all dates, deadlines, and time periods with descriptions (1 sentence each)\n" +
        "- missingClauses: Suggest important clauses that might be missing (1 sentence each)\n" +
        "- chunkSummaries: For each chunk of content, provide a brief summary of what it covers\n" +
        "\n" +
        "Return JSON only with: summary (string), keyTerms (array of {term, definition}), keyDates (array of {date, description}), missingClauses (array of {clauseName, reason}), chunkSummaries (array of {chunkIndex, summary}).",
    },
    {
      role: "user",
      content: `${roleInstruction}\n\nCOMPLETE ANALYSIS (${clauses.length} clauses analyzed):\n${clauseContext}\n\nGenerate comprehensive summary covering ALL analyzed content.`,
    },
  ]);
  const parsed = tryParseJson<{
    summary: string;
    keyTerms: any[];
    keyDates: any[];
    missingClauses: MissingClause[];
    chunkSummaries: any[];
  }>(output);
  if (!parsed) throw new Error("Failed to parse synthesis JSON");
  
  // Ensure chunkSummaries exists
  if (!parsed.chunkSummaries) {
    parsed.chunkSummaries = [];
  }
  
  return parsed;
};

/**
 * Creates summaries for each chunk to help users understand what each section covers
 */
const createChunkSummaries = async (
  chunks: string[],
  clauses: ClauseAnalysis[],
  role: string
): Promise<ChunkSummary[]> => {
  const chunkSummaries: ChunkSummary[] = [];
  
  // Group clauses by chunk (this is approximate since we don't track which chunk each clause came from)
  const clausesPerChunk = Math.ceil(clauses.length / chunks.length);
  
  for (let i = 0; i < chunks.length; i++) {
    const startIndex = i * clausesPerChunk;
    const endIndex = Math.min(startIndex + clausesPerChunk, clauses.length);
    const chunkClauses = clauses.slice(startIndex, endIndex);
    
    const roleInstruction = `The user's role is: ${role}. Summarize what this chunk covers.`;
    const clauseContext = chunkClauses
      .map(c => `- ${c.clauseText.substring(0, 100)}... (Risk: ${c.riskLevel})`)
      .join('\n');
    
    const output = await chatComplete([
      {
        role: "system",
        content:
          "You help laypeople. Create a simple 1-2 sentence summary of what this chunk of the document covers.\n" +
          "Focus on the main topics, not individual clauses. Use plain language.\n" +
          "Return only the summary text, no JSON or formatting.",
      },
      {
        role: "user",
        content: `${roleInstruction}\n\nCHUNK ${i + 1} CONTENT:\n${chunks[i].substring(0, 500)}...\n\nCLAUSES IN THIS CHUNK:\n${clauseContext}\n\nProvide a simple summary of what this chunk covers.`,
      },
    ]);
    
    chunkSummaries.push({
      chunkIndex: i + 1,
      summary: output.trim()
    });
  }
  
  return chunkSummaries;
};

/**
 * Enhanced contract analysis with semantic chunking
 * Uses the new PDF processing service for better text chunking
 */
export const analyzeContractWithSemanticChunking = async (
  documentText: string,
  role: string,
  onProgress: (message: string) => void,
  options: {
    chunkSize?: number;
    overlap?: number;
    useDocling?: boolean;
    doclingApiUrl?: string;
    doclingApiKey?: string;
  } = {}
): Promise<AnalysisResponse> => {
  onProgress("Processing document with semantic chunking...");
  
  // Use the new semantic chunking
  const chunks = await processPdfText(documentText, {
    chunkSize: options.chunkSize || 4000,
    overlap: options.overlap || 300,
    useDocling: options.useDocling || false,
    doclingApiUrl: options.doclingApiUrl,
    doclingApiKey: options.doclingApiKey,
  });

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

  onProgress("Creating chunk summaries...");
  const chunkSummaries = await createChunkSummaries(chunks, allClauses, role);

  onProgress("Synthesizing final report...");
  const finalReport = await synthesizeReport(allClauses, role);

  return {
    ...finalReport,
    clauses: allClauses,
    chunkSummaries: chunkSummaries,
  };
};

/**
 * Original contract analysis function (kept for backward compatibility)
 * Now uses the improved chunkText function
 */
export const analyzeContract = async (
  documentText: string,
  role: string,
  onProgress: (message: string) => void
): Promise<AnalysisResponse> => {
  console.log('analyzeContract: Starting analysis', { 
    documentLength: documentText?.length, 
    role 
  });

  onProgress("Converting PDF to Markdown for better parsing...");
  const markdownText = convertPdfToMarkdown(documentText);
  console.log('analyzeContract: Converted to Markdown', { 
    originalLength: documentText.length,
    markdownLength: markdownText.length 
  });

  onProgress("Chunking document...");
  const chunks = chunkText(markdownText);
  console.log('analyzeContract: Created chunks', { chunkCount: chunks.length });

  onProgress(`Analyzing ${chunks.length} document section(s)...`);
  const chunkResults = await Promise.all(
    chunks.map((chunk, index) => {
      console.log(`analyzeContract: Analyzing chunk ${index + 1}/${chunks.length}`, { 
        chunkLength: chunk.length 
      });
      return analyzeChunk(chunk, role);
    })
  );
  const allClauses = chunkResults.flat();
  console.log('analyzeContract: Analysis complete', { 
    totalClauses: allClauses.length,
    clausesByRisk: allClauses.reduce((acc, clause) => {
      acc[clause.riskLevel] = (acc[clause.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  if (allClauses.length === 0) {
    console.error('analyzeContract: No clauses found');
    throw new Error(
      "No legal clauses were identified in the document. It might be too short or in an unsupported format."
    );
  }

  onProgress("Creating chunk summaries...");
  const chunkSummaries = await createChunkSummaries(chunks, allClauses, role);

  onProgress("Synthesizing final report...");
  const finalReport = await synthesizeReport(allClauses, role);

  const result = {
    ...finalReport,
    clauses: allClauses,
    chunkSummaries: chunkSummaries,
  };

  console.log('analyzeContract: Final result', { 
    summaryLength: result.summary?.length,
    keyTermsCount: result.keyTerms?.length,
    keyDatesCount: result.keyDates?.length,
    missingClausesCount: result.missingClauses?.length,
    chunkSummariesCount: result.chunkSummaries?.length
  });

  return result;
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
