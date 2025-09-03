import React, { useMemo, useRef } from 'react';
import type { ClauseAnalysis } from '../types';
import { RISK_COLORS } from '../constants';

type DocumentPart = string | (ClauseAnalysis & { originalIndex: number });

interface DocumentViewProps {
    documentText: string;
    clauses: ClauseAnalysis[];
    activeClauseIndex: number | null;
    setActiveClauseIndex: (index: number | null) => void;
}

const DocumentView: React.FC<DocumentViewProps> = ({ documentText, clauses, activeClauseIndex, setActiveClauseIndex }) => {
    const activeClauseRef = useRef<HTMLSpanElement>(null);

    const parts: DocumentPart[] = useMemo(() => {
        if (!clauses || clauses.length === 0) {
            return [documentText];
        }

        const sortedClauses = [...clauses]
            .map((clause, index) => ({
                ...clause,
                originalIndex: index,
                start: documentText.indexOf(clause.clauseText),
            }))
            .filter(clause => clause.start !== -1)
            .sort((a, b) => a.start - b.start);

        const result: DocumentPart[] = [];
        let lastIndex = 0;

        sortedClauses.forEach(clause => {
            if (clause.start > lastIndex) {
                result.push(documentText.substring(lastIndex, clause.start));
            }
            result.push(clause);
            lastIndex = clause.start + clause.clauseText.length;
        });

        if (lastIndex < documentText.length) {
            result.push(documentText.substring(lastIndex));
        }

        return result;
    }, [documentText, clauses]);

    return (
        <div className="glass-card p-4 h-[75vh] overflow-y-auto rounded-xl">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                {parts.map((part, index) => {
                    if (typeof part === 'string') {
                        return <span key={index}>{part}</span>;
                    }
                    
                    const clause = part;
                    const isActive = activeClauseIndex === clause.originalIndex;
                    const colors = RISK_COLORS[clause.riskLevel];

                    return (
                        <span
                            key={index}
                            ref={isActive ? activeClauseRef : null}
                            id={`doc-clause-${clause.originalIndex}`}
                            className={`cursor-pointer transition-all duration-300 rounded p-0.5
                                ${isActive 
                                    ? `bg-indigo-500/40 text-white`
                                    // A bit of template literal magic to construct tailwind classes safely
                                    : `bg-${colors.text.split('-')[1]}-500/10 hover:bg-${colors.text.split('-')[1]}-500/20`
                                }`
                            }
                            onClick={() => {
                                const card = document.getElementById(`clause-card-${clause.originalIndex}`);
                                card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setActiveClauseIndex(clause.originalIndex);
                            }}
                             onMouseEnter={() => setActiveClauseIndex(clause.originalIndex)}
                             onMouseLeave={() => setActiveClauseIndex(null)}
                        >
                            {clause.clauseText}
                        </span>
                    );
                })}
            </pre>
        </div>
    );
};

export default DocumentView;