import React, { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import Header from "./components/Header";
import FileUpload from "./components/FileUpload";
import AnalysisDisplay from "./components/AnalysisDisplay";
import LoadingSpinner from "./components/LoadingSpinner";
import LoginView from "./components/auth/LoginView";
import SignupView from "./components/auth/SignupView";
import DashboardView from "./components/DashboardView";
import LandingPage from "./components/LandingPage";
import ErrorMessage from "./components/ErrorMessage";
import * as authService from "./services/authService";
import { analyzeContract } from "./services/analysisService";
import type { StoredAnalysis, User } from "./types";
import { LogoIcon } from "./components/Icons";

// @ts-ignore - setup pdf.js worker
if (window.pdfjsLib) {
  // @ts-ignore
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
}

function AppRoutes() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userAnalyses, setUserAnalyses] = useState<StoredAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] =
    useState<StoredAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  // Load user from localStorage or backend on startup
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const localUser = localStorage.getItem("user");
        if (localUser) {
          const parsedUser = JSON.parse(localUser);
          setCurrentUser(parsedUser);
          const analyses = authService.getUserAnalyses(parsedUser.id);
          setUserAnalyses(analyses);
          return;
        }

        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          const analyses = authService.getUserAnalyses(user.id);
          setUserAnalyses(analyses);
        }
      } catch {
        setCurrentUser(null);
      }
    };
    fetchUser();
  }, []);

  // Login handler
  const handleLogin = async (email: string, password: string) => {
    try {
      const user = await authService.login(email, password);
      setCurrentUser(user);
      localStorage.setItem("user", JSON.stringify(user));
      const analyses = authService.getUserAnalyses(user.id);
      setUserAnalyses(analyses);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  // Signup handler
  const handleSignup = async (username: string, email: string, password: string) => {
    try {
      const user = await authService.signup(username, email, password);
      setCurrentUser(user);
      localStorage.setItem("user", JSON.stringify(user));
      const analyses = authService.getUserAnalyses(user.id);
      setUserAnalyses(analyses);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Signup failed");
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await authService.logout();
    localStorage.removeItem("user");
    setCurrentUser(null);
    setUserAnalyses([]);
    setCurrentAnalysis(null);
    navigate("/");
  };

  // Analysis handling
  const handleStartAnalysis = useCallback(
    async (file: File, role: string) => {
      if (!currentUser) {
        setError("You must be logged in to analyze a document.");
        return;
      }

      setError(null);
      setCurrentAnalysis(null);
      setIsLoading(true);
      setLoadingMessage("Reading document...");

      const getPdfText = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            if (!e.target?.result) return reject(new Error("Failed to read PDF"));
            try {
              setLoadingMessage("Extracting text from PDF...");
              const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
              // @ts-ignore
              const pdf = await window.pdfjsLib.getDocument(typedArray).promise;
              let fullText = "";
              for (let i = 1; i <= pdf.numPages; i++) {
                setLoadingMessage(`Extracting page ${i}/${pdf.numPages}...`);
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                // Enhanced text extraction with better spacing
                const pageText = textContent.items
                  .map((item: any) => {
                    // Preserve spacing and line breaks
                    if (item.hasEOL) {
                      return item.str + '\n';
                    }
                    return item.str;
                  })
                  .join(' ')
                  .replace(/\s+/g, ' ') // Normalize spaces
                  .trim();
                
                fullText += pageText + "\n\n";
              }
              resolve(fullText);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsArrayBuffer(file);
        });
      };

      const getPlainText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result as string;
            text ? resolve(text) : reject(new Error("Failed to read text"));
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });
      };

      try {
        let text: string;
        if (file.type === "application/pdf") {
          text = await getPdfText(file);
        } else {
          text = await getPlainText(file);
        }

        if (!text || text.trim().length < 50) {
          throw new Error("Not enough text extracted from the document.");
        }

        const result = await analyzeContract(text, role, (msg) =>
          setLoadingMessage(msg)
        );

        const newAnalysis = authService.saveAnalysis(
          currentUser.id,
          result,
          file.name,
          text
        );
        setCurrentAnalysis(newAnalysis);
        setUserAnalyses(authService.getUserAnalyses(currentUser.id));
        navigate("/analysis");
      } catch (err: any) {
        setError(err.message || "Unknown analysis error");
        navigate("/dashboard");
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    },
    [currentUser, navigate]
  );

  const handleViewAnalysis = (analysis: StoredAnalysis) => {
    setCurrentAnalysis(analysis);
    navigate("/analysis");
  };

  const handleReset = () => {
    setError(null);
    setCurrentAnalysis(null);
    if (currentUser) {
      navigate("/dashboard");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen font-sans">
      <Header
        user={currentUser}
        onReset={handleReset}
        onLogout={handleLogout}
        onLoginClick={() => navigate("/login")}
        onSignupClick={() => navigate("/signup")}
      />
      <main className="container mx-auto px-4 py-10 max-w-7xl">
        {isLoading && <LoadingSpinner message={loadingMessage} />}
        {!isLoading && error && (
          <ErrorMessage
            message={error}
            onRetry={() => {
              setError(null);
              if (currentUser) navigate("/dashboard");
              else navigate("/");
            }}
          />
        )}

        {!isLoading && !error && (
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/login"
              element={<LoginView onLogin={handleLogin} onSwitchToSignup={() => navigate("/signup")} />}
            />
            <Route
              path="/signup"
              element={<SignupView onSignup={handleSignup} onSwitchToLogin={() => navigate("/login")} />}
            />
            <Route
              path="/dashboard"
              element={
                currentUser ? (
                  <DashboardView
                    user={currentUser}
                    analyses={userAnalyses}
                    onSelectAnalysis={handleViewAnalysis}
                    onNewAnalysis={() => navigate("/upload")}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/upload"
              element={
                currentUser ? (
                  <FileUpload onStartAnalysis={handleStartAnalysis} onBack={() => navigate("/dashboard")} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/analysis"
              element={
                currentAnalysis ? (
                  <AnalysisDisplay
                    analysisResult={currentAnalysis.analysisResult}
                    documentText={currentAnalysis.documentText}
                    onError={setError}
                    onBackToDashboard={() => navigate("/dashboard")}
                  />
                ) : (
                  <Navigate to="/dashboard" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      <footer className="text-center py-8 text-sm text-gray-500">
        <div className="flex items-center justify-center space-x-2">
          <LogoIcon className="h-6 w-6 text-indigo-500" />
          <p>UnBind: AI Legal Contract Analyzer</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
