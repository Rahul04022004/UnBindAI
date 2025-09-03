export enum RiskLevel {
    Low = 'Low',
    Medium = 'Medium',
    High = 'High',
    Negligible = 'Negligible',
}

export interface ClauseAnalysis {
    clauseText: string;
    simplifiedExplanation: string;
    riskLevel: RiskLevel;
    riskReason: string;
    negotiationSuggestion: string;
    suggestedRewrite?: string;
}

export interface KeyTerm {
    term: string;
    definition: string;
}

export interface KeyDate {
    date: string;
    description: string;
}

export interface MissingClause {
    clauseName: string;
    reason: string;
}

export interface ChunkSummary {
    chunkIndex: number;
    summary: string;
}

export interface AnalysisResponse {
    summary: string;
    clauses: ClauseAnalysis[];
    keyTerms: KeyTerm[];
    keyDates: KeyDate[];
    missingClauses: MissingClause[];
    chunkSummaries?: ChunkSummary[];
}

// --- NEW TYPES FOR AUTH & HISTORY ---

export interface User {
    id: string;
    username: string;
    email: string;
    picture?: string; // For Google profile picture
}

export interface StoredAnalysis {
    id: string;
    userId: string;
    fileName: string;
    analysisDate: string;
    analysisResult: AnalysisResponse;
    documentText: string;
}