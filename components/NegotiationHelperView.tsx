import React, { useState } from "react";
import type { AnalysisResponse, ClauseAnalysis } from "../types";
import { CopyIcon, CheckCircleIcon } from "./Icons";
import OverlayRephrasedPdf from "./OverlayRephrasedPdf";

interface NegotiationHelperViewProps {
  analysisResult: AnalysisResponse;
  activeClauseIndex: number | null;
  setActiveClauseIndex: (index: number | null) => void;
}

const NegotiationCard: React.FC<{
  clause: ClauseAnalysis;
  index: number;
  isActive: boolean;
  onHover: (index: number | null) => void;
  onClick: (index: number) => void;
}> = ({ clause, index, isActive, onHover, onClick }) => {
  const isFair = clause.negotiationSuggestion
    .toLowerCase()
    .includes("fair as is");
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
      className={`p-5 rounded-lg border transition-all duration-300 cursor-pointer ${
        isFair
          ? "border-green-500/30 bg-green-900/10"
          : "border-yellow-500/30 bg-yellow-900/10"
      } ${
        isActive ? `ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/20` : ""
      }`}
    >
      <div>
        <h4 className="font-semibold text-gray-300 mb-2">Original Clause</h4>
        <p className="text-sm text-gray-400 font-mono bg-black/30 p-3 rounded-md">
          {clause.clauseText}
        </p>
      </div>
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <h4
            className={`font-semibold ${
              isFair ? "text-green-300" : "text-yellow-300"
            }`}
          >
            {isFair ? "Clause Assessment" : "Negotiation Suggestion"}
          </h4>
          {!isFair && (
            <button
              onClick={handleCopy}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-200 bg-indigo-500/20 rounded-md hover:bg-indigo-500/40 transition-colors"
            >
              {copied ? (
                <CheckCircleIcon className="mr-1.5 h-4 w-4 text-green-400" />
              ) : (
                <CopyIcon className="mr-1.5 h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-200">{clause.negotiationSuggestion}</p>
      </div>
    </div>
  );
};

const NegotiationHelperView: React.FC<NegotiationHelperViewProps> = ({
  analysisResult,
  activeClauseIndex,
  setActiveClauseIndex,
}) => {
  const [showPreview, setShowPreview] = useState(false);

  const handleCardClick = (index: number) => {
    const docClause = document.getElementById(`doc-clause-${index}`);
    docClause?.scrollIntoView({ behavior: "smooth", block: "center" });
    setActiveClauseIndex(index);
  };

  const buildRephrasedDraft = (): string => {
    return analysisResult.clauses
      .map((c, i) => {
        const body =
          c.suggestedRewrite && c.suggestedRewrite.trim().length > 0
            ? c.suggestedRewrite.trim()
            : c.clauseText.trim();
        return `Clause ${i + 1}:\n${body}`;
      })
      .join("\n\n");
  };

  const buildCounterTips = (): string[] => {
    return analysisResult.clauses.map(
      (c, i) => `Clause ${i + 1}: ${c.negotiationSuggestion}`
    );
  };

  const exportRephrasedPdf = () => {
    // @ts-ignore
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    let y = margin;

    const addTitle = (text: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(text, margin, y);
      y += 18;
    };
    const addParagraph = (text: string, font: "normal" | "bold" = "normal") => {
      doc.setFont("helvetica", font as any);
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      lines.forEach((line: string) => {
        if (y + 14 > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 14;
      });
      y += 6;
    };
    const addSection = (title: string) => {
      if (y + 24 > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(title, margin, y);
      y += 16;
    };

    addTitle("UnBind: Balanced Rephrased Contract");
    addSection("Balanced Rephrased Draft");
    addParagraph(buildRephrasedDraft());
    addSection("Counter Tips for Negotiation");
    buildCounterTips().forEach((tip) => addParagraph(`• ${tip}`));
    doc.save("UnBind-Balanced-Rephrased-Contract.pdf");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">Negotiation Helper</h3>
          <p className="text-gray-300 max-w-3xl">
            Use these AI-powered suggestions to negotiate fairer terms. We've
            highlighted key clauses and provided alternative wording or
            strategic advice.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowPreview((s) => !s)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-300 bg-indigo-900/40 border border-indigo-500/50 rounded-md hover:bg-indigo-900/70 transition-colors"
          >
            {showPreview ? "Hide Rephrased Preview" : "Preview Rephrased Draft"}
          </button>
          <button
            type="button"
            onClick={exportRephrasedPdf}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-300 bg-indigo-900/40 border border-indigo-500/50 rounded-md hover:bg-indigo-900/70 transition-colors"
          >
            Export Rephrased PDF
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="p-4 rounded-lg border border-indigo-500/20 bg-gray-800/30">
          <h4 className="font-semibold text-indigo-300 mb-2">
            Balanced Rephrased Draft (Preview)
          </h4>
          <pre className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">
            {buildRephrasedDraft()}
          </pre>
          <div className="mt-4">
            <h5 className="text-sm font-semibold text-gray-300 mb-1">
              Counter Tips
            </h5>
            <ul className="list-disc ml-6 text-sm text-gray-200">
              {buildCounterTips().map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
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

      <div className="pt-4">
        <OverlayRephrasedPdf analysisResult={analysisResult} />
      </div>
    </div>
  );
};

export default NegotiationHelperView;
