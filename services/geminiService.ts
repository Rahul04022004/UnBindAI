import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResponse, ClauseAnalysis, MissingClause } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- RAG UTILITIES ---

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


// --- SCHEMA DEFINITIONS ---

const clauseSchemaDefinition = {
    type: Type.OBJECT,
    properties: {
        clauseText: { type: Type.STRING, description: 'The exact, verbatim text of the clause from the original document.' },
        simplifiedExplanation: { type: Type.STRING, description: 'An easy-to-understand explanation of the clause in plain English.' },
        riskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Negligible'] },
        riskReason: { type: Type.STRING, description: 'An explanation of why this risk level was assigned from the user\'s perspective.' },
        negotiationSuggestion: { type: Type.STRING, description: 'A suggested rewording or negotiation strategy. If fair, state that.' }
    },
    required: ['clauseText', 'simplifiedExplanation', 'riskLevel', 'riskReason', 'negotiationSuggestion']
};

const chunkAnalysisSchema = {
    type: Type.OBJECT,
    properties: {
        clauses: {
            type: Type.ARRAY,
            description: 'A list of all legal clauses identified within this text chunk.',
            items: clauseSchemaDefinition
        }
    },
    required: ['clauses']
};

const synthesisSchema = {
    type: Type.OBJECT,
    properties: {
        summary: { type: Type.STRING, description: 'A brief, high-level summary of the contract, synthesized from the provided clauses.' },
        keyTerms: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    term: { type: Type.STRING, description: 'The specific legal term.' },
                    definition: { type: Type.STRING, description: 'A simple definition.' }
                },
                required: ['term', 'definition']
            }
        },
        keyDates: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: 'The specific date or deadline.' },
                    description: { type: Type.STRING, description: 'An explanation of the date\'s significance.' }
                },
                required: ['date', 'description']
            }
        },
        missingClauses: {
            type: Type.ARRAY,
            description: "A list of standard clauses that seem to be missing from the contract, based on its likely type.",
            items: {
                type: Type.OBJECT,
                properties: {
                    clauseName: { type: Type.STRING, description: "The name of the missing clause (e.g., 'Force Majeure')." },
                    reason: { type: Type.STRING, description: "A brief explanation of why this clause is important for the user." }
                },
                required: ['clauseName', 'reason']
            }
        }
    },
    required: ['summary', 'keyTerms', 'keyDates', 'missingClauses']
};

// --- RAG IMPLEMENTATION ---

const analyzeChunk = async (chunk: string, role: string): Promise<ClauseAnalysis[]> => {
    const roleInstruction = `The user's role is: ${role}. Analyze all clauses from their perspective.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Analyze the following text from a legal document. Identify all distinct legal clauses. ${roleInstruction} Your output MUST be a single, valid JSON object that adheres to the provided schema. \n\nTEXT:\n${chunk}`,
            config: {
                systemInstruction: "You are an expert legal AI assistant. Your task is to extract and analyze legal clauses from a text chunk in a structured JSON format.",
                responseMimeType: "application/json",
                responseSchema: chunkAnalysisSchema,
            },
        });
        const result = JSON.parse(response.text);
        return result.clauses || [];
    } catch (error) {
        console.error("Error analyzing chunk:", error);
        return []; // Return empty array on chunk failure to not fail the whole analysis
    }
};

const synthesizeReport = async (clauses: ClauseAnalysis[], role: string): Promise<{ summary: string; keyTerms: any[]; keyDates: any[]; missingClauses: MissingClause[] }> => {
    const roleInstruction = `The user's role is: ${role}. Generate the summary and extract terms/dates from their perspective.`;
    const clauseContext = clauses.map((c, i) => `Clause ${i+1}:\n- Text: "${c.clauseText}"\n- Explanation: "${c.simplifiedExplanation}"\n- Risk: ${c.riskLevel}\n`).join('\n');

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the following list of pre-analyzed legal clauses from a contract, generate a high-level summary, extract all key legal terms and important dates, and identify any standard clauses that are missing. First, infer the type of contract (e.g., 'Employment Agreement', 'Lease Agreement'). Then, based on that type, list any common clauses that are absent and explain their importance for the user, whose role is '${role}'. Your output MUST be a single, valid JSON object. \n\nANALYZED CLAUSES:\n${clauseContext}`,
            config: {
                systemInstruction: "You are an expert legal AI assistant. Your task is to synthesize a high-level report from a list of pre-analyzed legal clauses into a structured JSON format. This includes identifying missing clauses.",
                responseMimeType: "application/json",
                responseSchema: synthesisSchema,
            },
        });
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Error synthesizing report:", error);
        throw new Error("Failed to synthesize the final report from the analyzed clauses.");
    }
};

export const analyzeContract = async (
    documentText: string, 
    role: string, 
    onProgress: (message: string) => void
): Promise<AnalysisResponse> => {
    try {
        onProgress('Chunking document...');
        const chunks = chunkText(documentText);

        onProgress(`Analyzing ${chunks.length} document section(s)...`);
        const chunkAnalysisPromises = chunks.map(chunk => analyzeChunk(chunk, role));
        const chunkResults = await Promise.all(chunkAnalysisPromises);
        const allClauses = chunkResults.flat();

        if (allClauses.length === 0) {
            throw new Error("No legal clauses were identified in the document. It might be too short or in an unsupported format.");
        }

        onProgress('Synthesizing final report...');
        const finalReport = await synthesizeReport(allClauses, role);

        return {
            ...finalReport,
            clauses: allClauses,
        };
    } catch (error) {
        console.error("Error in analyzeContract:", error);
        throw error;
    }
};


const findRelevantChunks = async (chunks: string[], scenario: string): Promise<string[]> => {
    try {
        const numberedChunks = chunks.map((chunk, index) => `[CHUNK ${index}]:\n${chunk}`).join('\n\n');
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `From the following numbered chunks of a legal document, identify the indices of the chunks that are most relevant to answering the user's question. Return a JSON object with a single key "relevant_indices" which is an array of numbers. \n\nQuestion: "${scenario}"\n\n${numberedChunks}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { relevant_indices: { type: Type.ARRAY, items: { type: Type.INTEGER } } },
                    required: ['relevant_indices']
                }
            }
        });

        const parsed = JSON.parse(response.text);
        const indices = parsed.relevant_indices as number[] || [];
        return indices.map(i => chunks[i]).filter(Boolean);
    } catch (error) {
        console.error("Error finding relevant chunks:", error);
        // Fallback to using all chunks if retrieval fails, to not block the user
        return chunks;
    }
};


export const simulateImpact = async (documentText: string, scenario: string): Promise<string> => {
    if (!scenario.trim()) {
        return "Please enter a scenario to simulate.";
    }
    try {
        const chunks = chunkText(documentText, 1500, 200);
        const relevantChunks = await findRelevantChunks(chunks, scenario);

        if (relevantChunks.length === 0) {
            return "Could not find any information in the document relevant to your scenario. Please try rephrasing your question or check if the topic is covered in the contract.";
        }

        const context = relevantChunks.join('\n\n---\n\n');
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Based on the following excerpts from a legal contract, what are the potential legal and financial consequences of this scenario: "${scenario}"? Provide a clear, step-by-step explanation suitable for a non-lawyer. \n\nContract Excerpts:\n${context}`,
            config: {
                systemInstruction: "You are an expert legal AI assistant. You will be given relevant excerpts from a legal contract and a hypothetical scenario. Your task is to analyze the excerpts and explain the likely consequences of the scenario in plain English.",
            },
        });
        
        return response.text;
    } catch (error) {
        console.error("Error simulating impact:", error);
        throw new Error("Failed to simulate the impact. The AI model may be overloaded. Please try again later.");
    }
};