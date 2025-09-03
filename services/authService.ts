import type { User, StoredAnalysis, AnalysisResponse } from '../types';

const ANALYSES_KEY = 'unbind_analyses';

// Point to backend explicitly
const API_BASE = "http://localhost:4000/api";

const apiFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...init
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const message = (data && (data.error || data.message)) || `Request failed: ${res.status}`;
        throw new Error(message);
    }
    return res.json() as Promise<T>;
};

// --- User Management via Backend ---

export const signup = async (username: string, email: string, password: string): Promise<User> => {
    return apiFetch<User>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
    });
};

export const login = async (email: string, password: string): Promise<User> => {
    return apiFetch<User>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
};

export const logout = async (): Promise<void> => {
    await apiFetch('/auth/logout', { method: 'POST' });
};

export const getCurrentUser = async (): Promise<User | null> => {
    try {
        return await apiFetch<User>('/auth/me');
    } catch {
        return null;
    }
};

// --- Analysis Management (still local for now) ---

const getAnalyses = (): StoredAnalysis[] => {
    try {
        const analyses = localStorage.getItem(ANALYSES_KEY);
        return analyses ? JSON.parse(analyses) : [];
    } catch (e) {
        return [];
    }
};

const saveAllAnalyses = (analyses: StoredAnalysis[]): void => {
    localStorage.setItem(ANALYSES_KEY, JSON.stringify(analyses));
};

export const saveAnalysis = (
    userId: string,
    analysisResult: AnalysisResponse,
    fileName: string,
    documentText: string
): StoredAnalysis => {
    const allAnalyses = getAnalyses();
    const newAnalysis: StoredAnalysis = {
        id: `analysis_${Date.now()}`,
        userId,
        fileName,
        analysisDate: new Date().toISOString(),
        analysisResult,
        documentText,
    };
    allAnalyses.push(newAnalysis);
    saveAllAnalyses(allAnalyses);
    return newAnalysis;
};

export const getUserAnalyses = (userId: string): StoredAnalysis[] => {
    const allAnalyses = getAnalyses();
    return allAnalyses
        .filter(a => a.userId === userId)
        .sort((a, b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime());
};
