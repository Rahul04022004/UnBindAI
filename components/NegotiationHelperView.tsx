import React, { useState } from 'react';
import type { AnalysisResponse, ClauseAnalysis } from '../types';
import { CopyIcon, CheckCircleIcon } from './Icons';

interface NegotiationHelperViewProps {
  analysisResult: AnalysisResponse;
  activeClauseIndex: number | null;
  setActiveClauseIndex: (index: number | null) => void;
}

const NegotiationCard: React.FC<{ clause: ClauseAnalysis; index: number; isActive: boolean; onHover: (index: number | null) => void; onClick: (index: number) => void; }> = ({ clause, index, isActive, onHover, onClick }) => {
  const isFair = clause.negotiationSuggestion.toLowerCase().includes("fair as is");
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click when copying
    navigator.clipboard.writeText(clause.negotiationSuggestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      onMouseEnter={() => onHover(index)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(index)}
      className={`p-5 rounded-lg border transition-all duration-300 cursor-pointer ${isFair ? 'border-green-500/30 bg-green-900/10' : 'border-yellow-500/30 bg-yellow-900/10'} ${isActive ? `ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/20` : ''}`}>
        <div>
          <h4 className="font-semibold text-gray-300 mb-2">Original Clause</h4>
          <p className="text-sm text-gray-400 font-mono bg-black/30 p-3 rounded-md">{clause.clauseText}</p>
        </div>
        <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className={`font-semibold ${isFair ? 'text-green-300' : 'text-yellow-300'}`}>
                    {isFair ? 'Clause Assessment' : 'Negotiation Suggestion'}
                </h4>
                {!isFair && (
                    <button 
                        onClick={handleCopy}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-500/20 rounded-md hover:bg-indigo-500/40 transition-colors"
                    >
                        {copied ? <CheckCircleIcon className="mr-1.5 h-4 w-4 text-green-400" /> : <CopyIcon className="mr-1.5 h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                )}
            </div>
          <p className="text-sm text-gray-200">{clause.negotiationSuggestion}</p>
        </div>
    </div>
  );
};

const NegotiationHelperView: React.FC<NegotiationHelperViewProps> = ({ analysisResult, activeClauseIndex, setActiveClauseIndex }) => {
  const handleCardClick = (index: number) => {
    const docClause = document.getElementById(`doc-clause-${index}`);
    docClause?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setActiveClauseIndex(index);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold text-white">Negotiation Helper</h3>
      <p className="text-gray-300 max-w-3xl">
        Use these AI-powered suggestions to negotiate fairer terms. We've highlighted key clauses and provided alternative wording or strategic advice.
      </p>
      <div className="space-y-5">
        {analysisResult.clauses.map((clause, index) => (
          <NegotiationCard 
            key={index} 
            clause={clause} 
            index={index}
            isActive={activeClauseIndex === index}
            onHover={setActiveClauseIndex}
            onClick={handleCardClick}
          />
        ))}
      </div>
    </div>
  );
};

export default NegotiationHelperView;