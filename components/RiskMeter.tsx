import React, { useState, useEffect, useMemo } from 'react';
import { ClauseAnalysis, RiskLevel } from '../types';

interface RiskMeterProps {
    clauses: ClauseAnalysis[];
}

const RISK_WEIGHTS: { [key in RiskLevel]: number } = {
    [RiskLevel.High]: 3,
    [RiskLevel.Medium]: 2,
    [RiskLevel.Low]: 1,
    [RiskLevel.Negligible]: 0,
    [RiskLevel.NoRisk]: 0, // No Risk clauses don't contribute to risk score
};

const getScoreColor = (score: number) => {
    if (score > 66) return 'text-red-400';
    if (score > 33) return 'text-yellow-400';
    return 'text-green-400';
};

const getScoreLabel = (score: number) => {
    if (score > 80) return 'Very High Risk';
    if (score > 60) return 'High Risk';
    if (score > 40) return 'Medium Risk';
    if (score > 20) return 'Low to Medium Risk';
    if (score > 5) return 'Low Risk';
    return 'Very Low Risk';
};

const RiskMeter: React.FC<RiskMeterProps> = ({ clauses }) => {
    const [animatedScore, setAnimatedScore] = useState(0);

    const overallScore = useMemo(() => {
        if (!clauses || clauses.length === 0) return 0;
        
        // Filter out "No Risk" clauses from risk calculation
        const riskClauses = clauses.filter(clause => clause.riskLevel !== RiskLevel.NoRisk);
        
        if (riskClauses.length === 0) return 0; // If all clauses are "No Risk", score is 0
        
        const totalPossibleScore = riskClauses.length * RISK_WEIGHTS.High;
        const actualScore = riskClauses.reduce((acc, clause) => acc + RISK_WEIGHTS[clause.riskLevel], 0);
        return totalPossibleScore > 0 ? (actualScore / totalPossibleScore) * 100 : 0;
    }, [clauses]);
    
    useEffect(() => {
        const timeout = setTimeout(() => {
            setAnimatedScore(overallScore);
        }, 100); // Small delay to trigger animation on mount

        return () => clearTimeout(timeout);
    }, [overallScore]);

    const rotation = (animatedScore / 100) * 180 - 90; // Map 0-100 score to -90 to 90 degrees

    return (
        <div className="flex flex-col items-center justify-center p-4 w-full max-w-xs">
            <div className="relative w-full">
                <svg viewBox="0 0 100 50" className="w-full">
                    {/* Background arcs */}
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#4ade80" strokeWidth="10" /> 
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#facc15" strokeWidth="10" strokeDasharray="125.6" strokeDashoffset="41.8" />
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#f87171" strokeWidth="10" strokeDasharray="125.6" strokeDashoffset="83.7" />
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#374151" strokeWidth="12" strokeLinecap="round" />
                </svg>
                {/* Needle */}
                <div
                    className="absolute bottom-0 left-1/2 w-px h-[40%] origin-bottom transition-transform duration-1000 ease-in-out"
                    style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
                >
                    <div className="w-1 h-full bg-gray-100 rounded-t-full" />
                </div>
                 {/* Pivot */}
                <div className="absolute bottom-0 left-1/2 w-4 h-4 bg-gray-100 border-2 border-gray-900 rounded-full transform -translate-x-1/2 translate-y-1/2" />
            </div>
            <div className="text-center mt-2">
                <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>
                    {Math.round(overallScore)}
                    <span className="text-xl text-gray-400">/100</span>
                </div>
                <div className="text-sm font-semibold text-gray-300 tracking-wider">
                    {getScoreLabel(overallScore)}
                </div>
            </div>
        </div>
    );
};

export default RiskMeter;
