import React, { useState, useCallback, useEffect } from "react";
import Header from "./components/Header";
import FileUpload from "./components/FileUpload";
import AnalysisDisplay from "./components/AnalysisDisplay";
import LoadingSpinner from "./components/LoadingSpinner";
import ErrorMessage from "./components/ErrorMessage";
import LoginView from "./components/auth/LoginView";
import SignupView from "./components/auth/SignupView";
import DashboardView from "./components/DashboardView";
import LandingPage from "./components/LandingPage";
import * as authService from "./services/authService";
import { analyzeContract } from "./services/analysisService";
import type { AnalysisResponse, StoredAnalysis, User } from "./types";
import { LogoIcon } from "./components/Icons";

// Configure the pdf.js worker from the CDN
// @ts-ignore
if (window.pdfjsLib) {
  // @ts-ignore
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
}

type View =
  | "landing"
  | "login"
  | "signup"
  | "dashboard"
  | "new_analysis"
  | "analysis_result";

export default function App(): React.ReactElement {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<View>("landing");

  const [userAnalyses, setUserAnalyses] = useState<StoredAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<StoredAnalysis | null>(
    null
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setUserAnalyses(authService.getUserAnalyses(user.id));
      setView("dashboard");
    } else {
      setView("landing");
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setUserAnalyses(authService.getUserAnalyses(user.id));
    setView("dashboard");
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setUserAnalyses([]);
    setCurrentAnalysis(null);
    setView("landing");
  };

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
            if (!e.target?.result) {
              return reject(new Error("Failed to read PDF file."));
            }
            try {
              setLoadingMessage("Extracting text from PDF...");
              const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
              // @ts-ignore
              const pdf = await window.pdfjsLib.getDocument(typedArray).promise;
              let fullText = "";
              for (let i = 1; i <= pdf.numPages; i++) {
                setLoadingMessage(
                  `Extracting text from PDF page ${i}/${pdf.numPages}...`
                );
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((s: any) => s.str)
                  .join(" ");
                fullText += pageText + "\n\n";
              }
              resolve(fullText);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read the file."));
          reader.readAsArrayBuffer(file);
        });
      };

      const getPlainText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result as string;
            if (text) resolve(text);
            else reject(new Error("Failed to read text from file."));
          };
          reader.onerror = () => reject(new Error("Failed to read the file."));
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
          throw new Error(
            "Could not extract enough text from the document. The file might be empty, corrupted, or an image-based PDF without readable text."
          );
        }

        const onProgress = (message: string) => {
          setLoadingMessage(message);
        };
        const result = await analyzeContract(text, role, onProgress);

        const newAnalysis = authService.saveAnalysis(
          currentUser.id,
          result,
          file.name,
          text
        );
        setCurrentAnalysis(newAnalysis);
        setUserAnalyses(authService.getUserAnalyses(currentUser.id));
        setView("analysis_result");
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred during analysis."
        );
        setView("dashboard"); // Go back to dashboard on error
      } finally {
        setIsLoading(false);
        setLoadingMessage("");
      }
    },
    [currentUser]
  );

  const handleReset = () => {
    setError(null);
    setCurrentAnalysis(null);
    if (currentUser) {
      setView("dashboard");
    } else {
      setView("landing");
    }
  };

  const handleViewAnalysis = (analysis: StoredAnalysis) => {
    setCurrentAnalysis(analysis);
    setView("analysis_result");
  };

  const renderContent = () => {
    if (isLoading) return <LoadingSpinner message={loadingMessage} />;

    switch (view) {
      case "landing":
        return (
          <LandingPage
            onSignupClick={() => setView("signup")}
            onLoginClick={() => setView("login")}
          />
        );
      case "login":
        return (
          <LoginView
            onLogin={handleLogin}
            onSwitchToSignup={() => setView("signup")}
          />
        );
      case "signup":
        return (
          <SignupView
            onSignup={handleLogin}
            onSwitchToLogin={() => setView("login")}
          />
        );
      case "dashboard":
        return currentUser ? (
          <DashboardView
            user={currentUser}
            analyses={userAnalyses}
            onSelectAnalysis={handleViewAnalysis}
            onNewAnalysis={() => setView("new_analysis")}
          />
        ) : null;
      case "new_analysis":
        if (error)
          return (
            <ErrorMessage
              message={error}
              onRetry={() => {
                setError(null);
                setView("dashboard");
              }}
            />
          );
        return <FileUpload onStartAnalysis={handleStartAnalysis} />;
      case "analysis_result":
        if (error)
          return (
            <ErrorMessage
              message={error}
              onRetry={() => {
                setError(null);
                setView("dashboard");
              }}
            />
          );
        if (currentAnalysis)
          return (
            <AnalysisDisplay
              analysisResult={currentAnalysis.analysisResult}
              documentText={currentAnalysis.documentText}
              onError={setError}
              onBackToDashboard={() => setView("dashboard")}
            />
          );
        return null;
    }
  };

  return (
    <div className="min-h-screen font-sans">
      <Header
        user={currentUser}
        onReset={handleReset}
        onLogout={handleLogout}
        onLoginClick={() => setView("login")}
        onSignupClick={() => setView("signup")}
      />
      <main className="container mx-auto px-4 py-10 max-w-7xl">
        {renderContent()}
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
