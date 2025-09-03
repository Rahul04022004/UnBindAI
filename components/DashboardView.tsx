import React from 'react';
import type { User, StoredAnalysis, RiskLevel } from '../types';
import { SparklesIcon, FileTextIcon, AlertCircleIcon, AlertTriangleIcon, ShieldCheckIcon, CheckCircleIcon } from './Icons';
import { RISK_COLORS } from '../constants';

interface DashboardViewProps {
    user: User;
    analyses: StoredAnalysis[];
    onSelectAnalysis: (analysis: StoredAnalysis) => void;
    onNewAnalysis: () => void;
}

const RiskSummary: React.FC<{ analysis: StoredAnalysis }> = ({ analysis }) => {
    const counts = analysis.analysisResult.clauses.reduce((acc, clause) => {
        acc[clause.riskLevel] = (acc[clause.riskLevel] || 0) + 1;
        return acc;
    }, {} as Record<RiskLevel, number>);

    return (
        <div className="flex items-center space-x-3 text-xs">
            {counts.High > 0 && (
                <div className={`flex items-center space-x-1 ${RISK_COLORS.High.text}`}>
                    <AlertCircleIcon className="h-4 w-4" />
                    <span>{counts.High} High</span>
                </div>
            )}
            {counts.Medium > 0 && (
                <div className={`flex items-center space-x-1 ${RISK_COLORS.Medium.text}`}>
                    <AlertTriangleIcon className="h-4 w-4" />
                    <span>{counts.Medium} Medium</span>
                </div>
            )}
            {counts.Low > 0 && (
                 <div className={`flex items-center space-x-1 ${RISK_COLORS.Low.text}`}>
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span>{counts.Low} Low</span>
                </div>
            )}
             {counts.Negligible > 0 && (
                 <div className={`flex items-center space-x-1 ${RISK_COLORS.Negligible.text}`}>
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>{counts.Negligible} Neg</span>
                </div>
            )}
        </div>
    )
}

const DashboardView: React.FC<DashboardViewProps> = ({ user, analyses, onSelectAnalysis, onNewAnalysis }) => {
    return (
        <div className="space-y-10 fade-in">
            <div>
                <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">Welcome back, {user.username}</h2>
                <p className="mt-4 text-lg leading-8 text-gray-400">
                    Review your past analyses or upload a new document to begin.
                </p>
            </div>

            <div className="glass-card p-6 sm:p-8 rounded-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-semibold text-white">Your Document History</h3>
                    <button
                        onClick={onNewAnalysis}
                        className="inline-flex items-center px-4 py-2 font-semibold text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-500 transition-colors text-sm shadow-lg"
                    >
                        Analyze New Document
                        <SparklesIcon className="ml-2 h-5 w-5" />
                    </button>
                </div>
                
                {analyses.length > 0 ? (
                    <div className="space-y-3">
                        {analyses.map(analysis => (
                            <div 
                                key={analysis.id}
                                onClick={() => onSelectAnalysis(analysis)}
                                className="group flex items-center justify-between p-4 rounded-lg bg-white/5 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/30 cursor-pointer transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-indigo-500/10"
                            >
                                <div className="flex items-center space-x-4">
                                    <FileTextIcon className="h-8 w-8 text-indigo-400 flex-shrink-0" />
                                    <div>
                                        <p className="font-semibold text-gray-100 group-hover:text-white">{analysis.fileName}</p>
                                        <p className="text-sm text-gray-400 group-hover:text-gray-300">
                                            Analyzed on {new Date(analysis.analysisDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <RiskSummary analysis={analysis} />
                                    <span className="text-indigo-400 text-lg font-semibold transform group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg">
                        <FileTextIcon className="mx-auto h-12 w-12 text-gray-600" />
                        <h3 className="mt-2 text-sm font-semibold text-gray-300">No documents analyzed</h3>
                        <p className="mt-1 text-sm text-gray-500">Click 'Analyze New Document' to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardView;
