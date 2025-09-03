import type { User, StoredAnalysis, AnalysisResponse } from '../types';

// NOTE: This is a simulation using localStorage. 
// In a real application, this would be handled by a secure backend server.

const USERS_KEY = 'unbind_users';
const ANALYSES_KEY = 'unbind_analyses';
const SESSION_KEY = 'unbind_session';

// --- User Management ---

const getUsers = (): (User & { passwordHash: string })[] => {
    try {
        const users = localStorage.getItem(USERS_KEY);
        return users ? JSON.parse(users) : [];
    } catch (e) {
        return [];
    }
};

const saveUsers = (users: (User & { passwordHash: string })[]): void => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const signup = (username: string, email: string, password: string): User => {
    const users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        throw new Error("This username is already taken.");
    }
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
        throw new Error("An account with this email already exists.");
    }

    // Super simple "hash" for this simulation. DO NOT use in production.
    const passwordHash = `hashed_${password}`;
    
    const newUser: User = {
        id: `user_${Date.now()}`,
        username,
        email,
    };

    users.push({ ...newUser, passwordHash });
    saveUsers(users);

    // Automatically log in after signup
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    return newUser;
};

export const login = (email: string, password: string): User => {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    // Super simple "check" for this simulation.
    if (user && user.passwordHash === `hashed_${password}`) {
        const userToStore: User = { id: user.id, username: user.username, email: user.email, picture: user.picture };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(userToStore));
        return userToStore;
    }

    throw new Error("Invalid email or password.");
};

export const handleGoogleLogin = (credential: string): User => {
    // In a real app, you'd send this credential to your backend to be securely verified.
    // For this client-side simulation, we'll decode it directly.
    const payload: { email: string; name: string; picture: string; } = JSON.parse(atob(credential.split('.')[1]));

    const users = getUsers();
    let user = users.find(u => u.email.toLowerCase() === payload.email.toLowerCase());

    if (!user) {
        // User doesn't exist, create a new account (auto-signup)
        const newUsername = payload.name || payload.email.split('@')[0];
        
        // Ensure username is unique
        let finalUsername = newUsername;
        let counter = 1;
        while(users.some(u => u.username.toLowerCase() === finalUsername.toLowerCase())) {
            finalUsername = `${newUsername}${counter}`;
            counter++;
        }
        
        const newUser: User = {
            id: `user_${Date.now()}`,
            username: finalUsername,
            email: payload.email,
            picture: payload.picture
        };
        // Fix: Assign the full user object with passwordHash to the 'user' variable
        // to match the expected type 'User & { passwordHash: string }'.
        user = { ...newUser, passwordHash: 'GOOGLE_AUTHENTICATED' };
        users.push(user);
        saveUsers(users);
    }
    
    const userToStore: User = { id: user.id, username: user.username, email: user.email, picture: user.picture };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(userToStore));
    return userToStore;
};

export const logout = (): void => {
    sessionStorage.removeItem(SESSION_KEY);
};

export const getCurrentUser = (): User | null => {
    try {
        const user = sessionStorage.getItem(SESSION_KEY);
        return user ? JSON.parse(user) : null;
    } catch (e) {
        return null;
    }
};

// --- Analysis Management ---

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

export const saveAnalysis = (userId: string, analysisResult: AnalysisResponse, fileName: string, documentText: string): StoredAnalysis => {
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