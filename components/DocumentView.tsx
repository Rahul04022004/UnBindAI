import React, { useMemo, useRef } from 'react';
import type { ClauseAnalysis } from '../types';
import { RISK_COLORS } from '../constants';

type DocumentPart = string | (ClauseAnalysis & { originalIndex: number; start: number; end: number });

interface DocumentViewProps {
    documentText: string;
    clauses: ClauseAnalysis[];
    activeClauseIndex: number | null;
    setActiveClauseIndex: (index: number | null) => void;
}

const DocumentView: React.FC<DocumentViewProps> = ({ documentText, clauses, activeClauseIndex, setActiveClauseIndex }) => {
    const activeClauseRef = useRef<HTMLSpanElement>(null);

    // 🔹 Move normalizeText to top-level so all functions can use it
    const normalizeText = (text: string) => text
        .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
        .replace(/[^\w\s.,;:!?()-]/g, '')  // Remove special characters except basic punctuation
        .toLowerCase()
        .trim();

    // Helper function to find actual position in original text
    const findActualPosition = (
        originalText: string,
        normalizedText: string,
        normalizedIndex: number
    ): number => {
        let originalIndex = 0;
        let normalizedIndexCount = 0;

        for (let i = 0; i < originalText.length && normalizedIndexCount < normalizedIndex; i++) {
            const char = originalText[i];
            const normalizedChar = normalizeText(char);
            if (normalizedChar) {
                normalizedIndexCount++;
            }
            originalIndex = i;
        }

        return originalIndex;
    };

    // Improved text matching function that handles variations in whitespace and formatting
    const findClauseInText = (
        clauseText: string,
        documentText: string,
        usedPositions: Set<number>
    ): { start: number; end: number } | null => {
        const normalizedClause = normalizeText(clauseText);
        const normalizedDocument = normalizeText(documentText);

        // Try exact match first
        let start = normalizedDocument.indexOf(normalizedClause);
        if (start !== -1) {
            const actualStart = findActualPosition(documentText, normalizedDocument, start);
            const actualEnd = actualStart + clauseText.length;

            if (!usedPositions.has(actualStart)) {
                usedPositions.add(actualStart);
                return { start: actualStart, end: actualEnd };
            }
        }

        // Try partial matching for cases where text might be slightly different
        const clauseWords = normalizedClause.split(' ').filter(word => word.length > 3);
        if (clauseWords.length > 0) {
            const firstWord = clauseWords[0];
            const lastWord = clauseWords[clauseWords.length - 1];

            const firstWordIndex = normalizedDocument.indexOf(firstWord);
            const lastWordIndex = normalizedDocument.indexOf(lastWord, firstWordIndex);

            if (firstWordIndex !== -1 && lastWordIndex !== -1 && lastWordIndex > firstWordIndex) {
                const actualStart = findActualPosition(documentText, normalizedDocument, firstWordIndex);
                const actualEnd = findActualPosition(documentText, normalizedDocument, lastWordIndex) + lastWord.length;

                if (!usedPositions.has(actualStart)) {
                    usedPositions.add(actualStart);
                    return { start: actualStart, end: actualEnd };
                }
            }
        }

        return null;
    };

    const parts: DocumentPart[] = useMemo(() => {
        console.log('DocumentView: Processing document', { 
            documentLength: documentText?.length, 
            clausesCount: clauses?.length 
        });

        if (!documentText || documentText.trim().length === 0) {
            console.warn('DocumentView: No document text provided');
            return ['No document text available'];
        }

        if (!clauses || clauses.length === 0) {
            console.log('DocumentView: No clauses provided, showing full document');
            return [documentText];
        }

        const usedPositions = new Set<number>();
        const matchedClauses: Array<ClauseAnalysis & { originalIndex: number; start: number; end: number }> = [];
        const unmatchedClauses: Array<ClauseAnalysis & { originalIndex: number }> = [];

        clauses.forEach((clause, index) => {
            if (!clause.clauseText || clause.clauseText.trim().length === 0) {
                console.warn(`DocumentView: Empty clause at index ${index}`);
                return;
            }

            const match = findClauseInText(clause.clauseText, documentText, usedPositions);
            if (match) {
                matchedClauses.push({
                    ...clause,
                    originalIndex: index,
                    start: match.start,
                    end: match.end,
                });
            } else {
                unmatchedClauses.push({
                    ...clause,
                    originalIndex: index,
                });
                console.warn(`DocumentView: Could not match clause ${index}: "${clause.clauseText.substring(0, 50)}..."`);
            }
        });

        const sortedClauses = matchedClauses.sort((a, b) => a.start - b.start);

        const result: DocumentPart[] = [];
        let lastIndex = 0;

        sortedClauses.forEach(clause => {
            if (clause.start > lastIndex) {
                const textBetween = documentText.substring(lastIndex, clause.start);
                if (textBetween.trim()) {
                    result.push(textBetween);
                }
            }
            result.push(clause);
            lastIndex = clause.end;
        });

        if (lastIndex < documentText.length) {
            const remainingText = documentText.substring(lastIndex);
            if (remainingText.trim()) {
                result.push(remainingText);
            }
        }

        if (result.length === 0) {
            console.warn('DocumentView: No matches found, showing full document');
            return [documentText];
        }

        if (unmatchedClauses.length > 0) {
            result.push('\n\n--- UNMATCHED CLAUSES (for debugging) ---\n');
            unmatchedClauses.forEach(clause => {
                result.push({
                    ...clause,
                    start: documentText.length,
                    end: documentText.length + clause.clauseText.length,
                });
                result.push('\n');
            });
        }

        console.log(`DocumentView: Matched ${matchedClauses.length}/${clauses.length} clauses, result parts: ${result.length}`);
        
        return result;
    }, [documentText, clauses]);

    const safeParts = parts && parts.length > 0 ? parts : [documentText || 'No content available'];

    return (
        <div className="glass-card p-6 h-[75vh] overflow-y-auto rounded-xl">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white text-gray-900 shadow-lg rounded-lg p-8 min-h-full">
                    <div className="prose prose-lg max-w-none">
                        {safeParts.map((part, index) => {
                            if (typeof part === 'string') {
                                if (!part || part.trim().length === 0) {
                                    return <span key={index}></span>;
                                }

                                const formattedText = part
                                    .split('\n')
                                    .map((line, lineIndex) => {
                                        const isHeading = line.length < 80 && line.length > 3 && 
                                            (line === line.toUpperCase() || 
                                             /^\d+\.\s/.test(line) || 
                                             /^[A-Z]\.\s/.test(line) ||
                                             /^(SECTION|CHAPTER|PART|ARTICLE|CLAUSE)/i.test(line));
                                        
                                        if (isHeading) {
                                            // Determine heading level and styling
                                            let headingClass = "text-xl font-bold text-gray-800 mt-8 mb-4 first:mt-0 bg-gray-100 px-4 py-2 rounded-lg border-l-4 border-indigo-500";
                                            
                                            // Check for different heading levels
                                            if (/^\d+\.\s/.test(line)) {
                                                const match = line.match(/^(\d+(?:\.\d+)*)\.?\s/);
                                                if (match) {
                                                    const level = match[1].split('.').length;
                                                    
                                                    // Different styling for different levels
                                                    if (level === 1) {
                                                        headingClass = "text-2xl font-bold text-gray-900 mt-8 mb-4 first:mt-0 bg-indigo-50 px-4 py-3 rounded-lg border-l-4 border-indigo-600 shadow-sm";
                                                    } else if (level === 2) {
                                                        headingClass = "text-xl font-bold text-gray-800 mt-6 mb-3 bg-blue-50 px-3 py-2 rounded-lg border-l-4 border-blue-500";
                                                    } else {
                                                        headingClass = "text-lg font-semibold text-gray-700 mt-4 mb-2 bg-gray-50 px-3 py-1 rounded border-l-3 border-gray-400";
                                                    }
                                                }
                                            } else if (line === line.toUpperCase() && line.length > 5) {
                                                // All caps headings (main titles)
                                                headingClass = "text-3xl font-bold text-gray-900 mt-10 mb-6 first:mt-0 bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 rounded-xl border-l-6 border-indigo-600 shadow-md";
                                            } else if (/^(SECTION|CHAPTER|PART|ARTICLE|CLAUSE)/i.test(line)) {
                                                // Keyword-based headings
                                                headingClass = "text-xl font-bold text-gray-800 mt-6 mb-3 bg-yellow-50 px-4 py-2 rounded-lg border-l-4 border-yellow-500";
                                            }
                                            
                                            return (
                                                <h3 key={lineIndex} className={headingClass}>
                                                    {line}
                                                </h3>
                                            );
                                        }
                                        
                                        if (line.trim()) {
                                            return (
                                                <p key={lineIndex} className="text-gray-700 leading-relaxed mb-3">
                                                    {line}
                                                </p>
                                            );
                                        }
                                        
                                        return <br key={lineIndex} />;
                                    });
                                
                                return <span key={index}>{formattedText}</span>;
                            }
                            
                            const clause = part;
                            const isActive = activeClauseIndex === clause.originalIndex;
                            const colors = RISK_COLORS[clause.riskLevel];

                            const getHoverColor = (riskLevel: string) => {
                                switch (riskLevel) {
                                    case 'High': return 'hover:bg-red-100 hover:border-red-300';
                                    case 'Medium': return 'hover:bg-yellow-100 hover:border-yellow-300';
                                    case 'Low': return 'hover:bg-green-100 hover:border-green-300';
                                    case 'Negligible': return 'hover:bg-blue-100 hover:border-blue-300';
                                    case 'No Risk': return 'hover:bg-gray-100 hover:border-gray-300';
                                    default: return 'hover:bg-gray-100 hover:border-gray-300';
                                }
                            };

                            const getActiveColor = (riskLevel: string) => {
                                switch (riskLevel) {
                                    case 'High': return 'bg-red-200 border-red-400 shadow-red-200';
                                    case 'Medium': return 'bg-yellow-200 border-yellow-400 shadow-yellow-200';
                                    case 'Low': return 'bg-green-200 border-green-400 shadow-green-200';
                                    case 'Negligible': return 'bg-blue-200 border-blue-400 shadow-blue-200';
                                    case 'No Risk': return 'bg-gray-200 border-gray-400 shadow-gray-200';
                                    default: return 'bg-gray-200 border-gray-400 shadow-gray-200';
                                }
                            };

                            return (
                                <span
                                    key={index}
                                    ref={isActive ? activeClauseRef : null}
                                    id={`doc-clause-${clause.originalIndex}`}
                                    className={`cursor-pointer transition-all duration-300 rounded-md px-1 py-0.5 border border-transparent
                                        ${isActive 
                                            ? `${getActiveColor(clause.riskLevel)} shadow-lg`
                                            : `border-${colors.text.split('-')[1]}-200 ${getHoverColor(clause.riskLevel)}`
                                        }`
                                    }
                                    onClick={() => {
                                        const card = document.getElementById(`clause-card-${clause.originalIndex}`);
                                        card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        setActiveClauseIndex(clause.originalIndex);
                                    }}
                                    onMouseEnter={() => setActiveClauseIndex(clause.originalIndex)}
                                    onMouseLeave={() => setActiveClauseIndex(null)}
                                    title={`${clause.riskLevel === 'No Risk' ? 'No Risk' : `${clause.riskLevel} Risk`}: ${clause.simplifiedExplanation}`}
                                >
                                    {clause.clauseText}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>
            
            {(!documentText || documentText.trim().length === 0) && (
                <div className="text-center py-8 text-gray-500">
                    <p>No document content available</p>
                </div>
            )}
        </div>
    );
};

export default DocumentView;
