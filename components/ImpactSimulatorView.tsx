import React, { useState, useCallback } from "react";
import { simulateImpact } from "../services/analysisService";
import { SparklesIcon } from "./Icons";

interface ImpactSimulatorViewProps {
  documentText: string;
  onError: (message: string) => void;
}

const ImpactSimulatorView: React.FC<ImpactSimulatorViewProps> = ({
  documentText,
  onError,
}) => {
  const [scenario, setScenario] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!scenario || isLoading) return;

      setIsLoading(true);
      setResult("");
      onError("");

      try {
        const simulationResult = await simulateImpact(documentText, scenario);
        setResult(simulationResult);
      } catch (err) {
        onError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred during simulation."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [scenario, isLoading, documentText, onError]
  );

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-2xl font-bold text-white">Impact Simulator</h3>
        <p className="text-gray-300 mt-2 max-w-3xl">
          Test potential real-world scenarios against your contract. Enter a
          situation (e.g., "What if I quit my job after 3 months?") to
          understand the legal and financial consequences.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          placeholder="Enter a scenario, for example: 'What happens if I miss a rent payment by one week?'"
          className="w-full p-3 bg-gray-900/70 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-white placeholder-gray-500"
          rows={3}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !scenario}
          className="inline-flex items-center px-6 py-2.5 font-semibold text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Simulating..." : "Simulate Impact"}
          <SparklesIcon className="ml-2 h-5 w-5" />
        </button>
      </form>

      {isLoading && (
        <div className="flex items-center justify-center p-6 text-gray-400">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Analyzing potential outcomes...
        </div>
      )}

      {result && (
        <div className="mt-6 p-5 glass-card rounded-lg fade-in">
          <h4 className="font-semibold text-lg text-indigo-300 mb-2">
            Simulation Result
          </h4>
          <p className="text-gray-200 whitespace-pre-wrap leading-relaxed">
            {result}
          </p>
        </div>
      )}
    </div>
  );
};

export default ImpactSimulatorView;
