import React from 'react';
import { LogoIcon, SparklesIcon, ShieldCheckIcon, FileTextIcon, DownloadIcon } from './Icons';
import { Route, Routes, useNavigate } from 'react-router-dom';

interface LandingPageProps {
  onSignupClick: () => void;
  onLoginClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSignupClick, onLoginClick }) => {
  return (
    <div className="w-full fade-in">
      {/* Hero */}
      <section className="pt-12 sm:pt-16 lg:pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center space-x-3 mb-6">
              <LogoIcon className="h-10 w-10 text-indigo-500" />
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                Understand Contracts with Confidence
              </h1>
            </div>
            <p className="mt-4 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              UnBind turns complex legal language into plain English, flags risks, and suggests fair alternatives — all in minutes.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onSignupClick}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 font-semibold text-white bg-indigo-600 border border-transparent rounded-lg shadow-lg hover:bg-indigo-500 transition-colors"
              >
                Get Started Free
                <SparklesIcon className="ml-2 h-5 w-5" />
              </button>
              <button
                onClick={onLoginClick}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 font-semibold text-indigo-300 bg-white/5 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mt-14 sm:mt-16 lg:mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center space-x-3">
                <FileTextIcon className="h-6 w-6 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Clause-by-Clause Clarity</h3>
              </div>
              <p className="mt-3 text-gray-300">
                See each clause explained in simple terms with risk levels highlighted and linked to your document.
              </p>
            </div>
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center space-x-3">
                <ShieldCheckIcon className="h-6 w-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">Negotiate Fairly</h3>
              </div>
              <p className="mt-3 text-gray-300">
                Get practical, copyable suggestions to improve risky clauses — or confirmation when terms are fair.
              </p>
            </div>
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center space-x-3">
                <DownloadIcon className="h-6 w-6 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Export & Act</h3>
              </div>
              <p className="mt-3 text-gray-300">
                Export polished PDFs, add key dates to your calendar, and simulate real-world scenarios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="mt-14 sm:mt-16 lg:mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-600/20 to-gray-900/40 border border-indigo-500/30 text-center">
            <h3 className="text-2xl font-bold text-white">Ready to try UnBind?</h3>
            <p className="mt-2 text-gray-300">Sign up free and analyze your first contract in minutes.</p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onSignupClick}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 font-semibold text-white bg-indigo-600 border border-transparent rounded-lg shadow-lg hover:bg-indigo-500 transition-colors"
              >
                Create Account
              </button>
              <button
                onClick={onLoginClick}
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 font-semibold text-indigo-300 bg-white/5 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 transition-colors"
              >
                I already have an account
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const App = () => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            onSignupClick={() => navigate("/signup")}
            onLoginClick={() => navigate("/login")}
          />
        }
      />
      {/* Other routes can be defined here */}
    </Routes>
  );
};

export default App;


