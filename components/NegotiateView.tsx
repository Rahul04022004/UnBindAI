import React, { useState } from "react";
import type { AnalysisResponse, ClauseAnalysis } from "../types";
import { RiskLevel } from "../types";
import { CopyIcon, CheckCircleIcon } from "./Icons";
import ImpactSimulatorView from "./ImpactSimulatorView";
import OverlayRephrasedPdf from "./OverlayRephrasedPdf";

interface NegotiateViewProps {
  analysisResult: AnalysisResponse;
  documentText: string;
  activeClauseIndex: number | null;
  setActiveClauseIndex: (index: number | null) => void;
  onError: (message: string) => void;
}

interface ClauseResolution {
  clauseIndex: number;
  choice: "ai" | "user" | "original";
  userText?: string;
  isResolved: boolean;
}

const NegotiateView: React.FC<NegotiateViewProps> = ({
  analysisResult,
  documentText,
  activeClauseIndex,
  setActiveClauseIndex,
  onError,
}) => {
  const [activeTab, setActiveTab] = useState<"risks" | "simulator">("risks");
  const [resolutions, setResolutions] = useState<ClauseResolution[]>([]);
  const [userInputs, setUserInputs] = useState<{ [key: number]: string }>({});

  // Exclude Negligible & No Risk from negotiation list
  const riskyClauses = analysisResult.clauses.filter(
    (clause) =>
      clause.riskLevel !== RiskLevel.Negligible &&
      clause.riskLevel !== RiskLevel.NoRisk
  );

  const getResolution = (clauseIndex: number): ClauseResolution => {
    return (
      resolutions.find((r) => r.clauseIndex === clauseIndex) || {
        clauseIndex,
        choice: "ai",
        isResolved: false,
      }
    );
  };

  const updateResolution = (
    clauseIndex: number,
    choice: "ai" | "user" | "original",
    userText?: string
  ) => {
    setResolutions((prev) => {
      const existing = prev.find((r) => r.clauseIndex === clauseIndex);
      if (existing) {
        return prev.map((r) =>
          r.clauseIndex === clauseIndex
            ? { ...r, choice, userText, isResolved: true }
            : r
        );
      } else {
        return [...prev, { clauseIndex, choice, userText, isResolved: true }];
      }
    });
  };

  const confirmChoice = (clauseIndex: number) => {
    const resolution = getResolution(clauseIndex);
    if (resolution.choice === "user" && userInputs[clauseIndex]) {
      updateResolution(clauseIndex, "user", userInputs[clauseIndex]);
    } else if (resolution.choice === "ai") {
      updateResolution(clauseIndex, "ai");
    } else if (resolution.choice === "original") {
      updateResolution(clauseIndex, "original");
    }
  };

  const getFinalText = (
    clause: ClauseAnalysis,
    clauseIndex: number
  ): string => {
    const resolution = getResolution(clauseIndex);
    switch (resolution.choice) {
      case "ai":
        return clause.suggestedRewrite || clause.clauseText;
      case "user":
        return userInputs[clauseIndex] || clause.clauseText;
      case "original":
        return clause.clauseText;
      default:
        return clause.clauseText;
    }
  };

  const rephraseUserText = async (
    userText: string,
    originalText: string
  ): Promise<string> => {
    try {
      // @ts-ignore
      const { chatComplete } = await import("../services/groqService");

      const response = await chatComplete(
        [
          {
            role: "system",
            content:
              "You are a legal writing assistant. Rephrase the user's custom text to blend naturally with the original document's tone and style while maintaining the user's intent. Keep it professional and clear.",
          },
          {
            role: "user",
            content: `Original clause: "${originalText}"\n\nUser's custom rewrite: "${userText}"\n\nRephrase the user's text to blend better with the document style while keeping their meaning.`,
          },
        ],
        "llama-3.3-70b-versatile",
        0.3
      );

      return response.trim();
    } catch (e) {
      console.error("Failed to rephrase user text:", e);
      return userText; // Fallback to original user text
    }
  };

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setSourceFile(file);
    } else {
      onError("Please upload a PDF file.");
    }
  };

  const exportFinalPdf = async () => {
    if (!sourceFile) {
      onError("Please upload the original PDF document first.");
      return;
    }

    try {
      setIsBuilding(true);
      // @ts-ignore
      const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
      // @ts-ignore
      const pdfjsLib = (window as any).pdfjsLib;
      if (!PDFDocument || !pdfjsLib)
        throw new Error("pdf-lib or pdf.js not available");

      // Load the original PDF
      const bytes = await sourceFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(bytes);
      const outDoc = await PDFDocument.create();
      const helvetica = await outDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);

      // Get page dimensions from original
      const pages = srcDoc.getPages();
      const pageDimensions = pages.map((page) => page.getSize());

      // Extract text from original PDF using pdf.js
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;

      const normalizeSpaces = (s: string) => s.replace(/\s+/g, " ").trim();
      const pageContent: Array<{ text: string; y: number; page: number }>[] =
        [];

      // Extract text from each page
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();
        const items = textContent.items.map((it: any) => ({
          str: it.str,
          y: viewport.height - it.transform[5], // Convert to PDF-Lib Y-coord
        }));

        // Group text items into lines and detect paragraphs
        const lines: { text: string; y: number }[] = [];
        let currentLine: { text: string; y: number } | null = null;

        items.sort((a: any, b: any) => b.y - a.y || a.str.localeCompare(b.str)); // Sort by Y-desc, then X-asc

        items.forEach((item: any) => {
          if (!currentLine || Math.abs(currentLine.y - item.y) > 2) {
            // New line if Y-diff is significant
            if (currentLine) lines.push(currentLine);
            currentLine = { text: item.str, y: item.y };
          } else {
            currentLine.text +=
              (currentLine.text.endsWith("-") ? "" : " ") + item.str; // Concatenate words
          }
        });
        if (currentLine) lines.push(currentLine);

        // Detect paragraphs by larger vertical gaps
        const pageParagraphs: { text: string; y: number; page: number }[] = [];
        let currentParagraph = "";
        let lastY = -1;
        const lineHeight = 14;

        lines.forEach((line, idx) => {
          if (lastY !== -1 && lastY - line.y > lineHeight * 1.5) {
            // Large gap indicates new paragraph
            if (currentParagraph)
              pageParagraphs.push({
                text: normalizeSpaces(currentParagraph),
                y: lastY,
                page: p - 1,
              });
            currentParagraph = line.text;
          } else {
            currentParagraph += (currentParagraph ? " " : "") + line.text;
          }
          lastY = line.y;
        });
        if (currentParagraph)
          pageParagraphs.push({
            text: normalizeSpaces(currentParagraph),
            y: lastY,
            page: p - 1,
          });
        pageContent.push(pageParagraphs);
      }

      // Flatten pageContent into a single list of paragraphs for easier processing
      let allParagraphs: { text: string; y: number; page: number }[] =
        pageContent.flat();

      // Apply clause-level rewrites to the combined normalized text
      const clauses = riskyClauses
        .map((c, index) => {
          const resolution = getResolution(index);
          if (resolution.isResolved) {
            let finalText = getFinalText(c, index);
            // If user custom text, rephrase it to blend better
            if (resolution.choice === "user" && userInputs[index]) {
              // Note: We'll handle rephrasing in the loop below
              return {
                original: normalizeSpaces(c.clauseText),
                rewrite: userInputs[index], // Will be rephrased below
                needsRephrasing: true,
              };
            }
            return {
              original: normalizeSpaces(c.clauseText),
              rewrite: normalizeSpaces(finalText),
              needsRephrasing: false,
            };
          }
          return null;
        })
        .filter(Boolean);

      // Apply rephrasing for user custom text
      for (const cl of clauses) {
        if (cl && cl.needsRephrasing) {
          cl.rewrite = await rephraseUserText(cl.rewrite, cl.original);
        }
      }

      // Apply changes to paragraphs
      for (const cl of clauses) {
        if (!cl || !cl.original || cl.original === cl.rewrite) continue;

        // Find and replace in allParagraphs
        for (let i = 0; i < allParagraphs.length; i++) {
          const paragraph = allParagraphs[i];
          const idx = paragraph.text.indexOf(cl.original);
          if (idx !== -1) {
            paragraph.text =
              paragraph.text.slice(0, idx) +
              cl.rewrite +
              paragraph.text.slice(idx + cl.original.length);
            break; // Assume one replacement per clause
          }
        }
      }

      // Create new pages with same dimensions as original
      const newPages: any[] = [];
      pageDimensions.forEach((dimensions) => {
        newPages.push(outDoc.addPage([dimensions.width, dimensions.height]));
      });

      const margin = 48;
      const lineHeight = 14;
      const fontSize = 10.5;
      const textColor = rgb(0, 0, 0);
      const highlightColor = rgb(1, 1, 0.8); // Light yellow
      const changedTextColor = rgb(0.8, 0.2, 0.2); // Red

      let currentPageIndex = 0;
      let currentY = newPages[currentPageIndex].getHeight() - margin;

      const currentPage = () => newPages[currentPageIndex];
      const maxWidth = () => currentPage().getWidth() - margin * 2;

      const writeText = (
        text: string,
        font: any,
        size: number,
        bold: boolean = false,
        isChanged: boolean = false
      ) => {
        const tokens = text.split(/\s+/);
        let line = "";
        tokens.forEach((tok) => {
          const test = line ? line + " " + tok : tok;
          if (font.widthOfTextAtSize(test, size) > maxWidth()) {
            if (line) {
              if (currentY < margin + lineHeight) {
                currentPageIndex++;
                if (currentPageIndex >= newPages.length) {
                  newPages.push(outDoc.addPage(newPages[0].getSize()));
                }
                currentY = currentPage().getHeight() - margin;
              }

              // Draw highlight background for changed lines
              if (isChanged) {
                currentPage().drawRectangle({
                  x: margin - 4,
                  y: currentY - 2,
                  width: font.widthOfTextAtSize(line, size) + 8,
                  height: lineHeight + 4,
                  color: highlightColor,
                  opacity: 0.3,
                });
              }

              currentPage().drawText(line, {
                x: margin,
                y: currentY,
                size,
                font: bold ? helveticaBold : font,
                color: isChanged ? changedTextColor : textColor,
              });
              currentY -= lineHeight;
            }
            line = tok;
          } else {
            line = test;
          }
        });
        if (line) {
          if (currentY < margin + lineHeight) {
            currentPageIndex++;
            if (currentPageIndex >= newPages.length) {
              newPages.push(outDoc.addPage(newPages[0].getSize()));
            }
            currentY = currentPage().getHeight() - margin;
          }

          // Draw highlight background for changed lines
          if (isChanged) {
            currentPage().drawRectangle({
              x: margin - 4,
              y: currentY - 2,
              width: font.widthOfTextAtSize(line, size) + 8,
              height: lineHeight + 4,
              color: highlightColor,
              opacity: 0.3,
            });
          }

          currentPage().drawText(line, {
            x: margin,
            y: currentY,
            size,
            font: bold ? helveticaBold : font,
            color: isChanged ? changedTextColor : textColor,
          });
          currentY -= lineHeight;
        }
      };

      // Title
      writeText(
        `UnBind: Negotiated Contract - ${sourceFile.name}`,
        helveticaBold,
        16,
        true
      );
      currentY -= lineHeight;
      writeText(
        "This document shows all negotiated changes applied to your original contract.",
        helvetica,
        11
      );
      currentY -= lineHeight * 2;

      // Write all modified paragraphs
      allParagraphs.forEach((par, idx) => {
        // Check if this paragraph contains any changes
        const hasChanges = clauses.some(
          (cl) => cl && par.text.includes(cl.rewrite)
        );
        writeText(par.text, helvetica, fontSize, hasChanges, hasChanges); // Use bold font for changed text
        currentY -= lineHeight; // Add extra spacing between paragraphs
      });

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `UnBind-Negotiated-${sourceFile.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      onError("Failed to export negotiated contract.");
    } finally {
      setIsBuilding(false);
    }
  };

  const RiskClauseCard: React.FC<{ clause: ClauseAnalysis; index: number }> = ({
    clause,
    index,
  }) => {
    const resolution = getResolution(index);
    const [copied, setCopied] = useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const handleCopy = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    const handleChoiceChange = (choice: "ai" | "user" | "original") => {
      setResolutions((prev) => {
        const existing = prev.find((r) => r.clauseIndex === index);
        if (existing) {
          return prev.map((r) =>
            r.clauseIndex === index ? { ...r, choice, isResolved: false } : r
          );
        } else {
          return [...prev, { clauseIndex: index, choice, isResolved: false }];
        }
      });
    };

    const handleUserInputChange = (text: string) => {
      setUserInputs((prev) => ({ ...prev, [index]: text }));
    };

    return (
      <div
        onMouseEnter={() => setActiveClauseIndex(index)}
        onMouseLeave={() => setActiveClauseIndex(null)}
        className={`p-6 rounded-lg border transition-all duration-300 ${
          resolution.isResolved
            ? "border-green-500/30 bg-green-900/10"
            : "border-yellow-500/30 bg-yellow-900/10"
        } ${
          activeClauseIndex === index
            ? "ring-2 ring-indigo-400 shadow-lg shadow-indigo-500/20"
            : ""
        }`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                clause.riskLevel === RiskLevel.High
                  ? "bg-red-900/40 text-red-300"
                  : clause.riskLevel === RiskLevel.Medium
                  ? "bg-yellow-900/40 text-yellow-300"
                  : clause.riskLevel === RiskLevel.Low
                  ? "bg-orange-900/40 text-orange-300"
                  : "bg-green-900/40 text-green-300" // Negligible & NoRisk
              }`}
            >
              {clause.riskLevel} Risk
            </span>
            {resolution.isResolved && (
              <span className="px-2 py-1 rounded-full text-xs bg-green-900/40 text-green-300">
                ✓ Resolved
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-300 mb-2">
              Original Clause
            </h4>
            <p className="text-sm text-gray-400 font-mono bg-black/30 p-3 rounded-md">
              {clause.clauseText}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-gray-300 mb-2">
              Risk Explanation
            </h4>
            <p className="text-sm text-gray-200">{clause.riskReason}</p>
          </div>

          {clause.suggestedRewrite && (
            <div>
              <h4 className="font-semibold text-indigo-300 mb-2">
                AI Suggested Rewrite
              </h4>
              <div className="flex items-start space-x-2">
                <p className="text-sm text-gray-200 bg-indigo-900/20 p-3 rounded-md flex-1">
                  {clause.suggestedRewrite}
                </p>
                <button
                  onClick={() => handleCopy(clause.suggestedRewrite!)}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-200 bg-indigo-500/20 rounded-md hover:bg-indigo-500/40 transition-colors"
                >
                  {copied ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-400" />
                  ) : (
                    <CopyIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-gray-300 mb-3">
              Choose Final Version
            </h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="radio"
                  name={`choice-${index}`}
                  checked={resolution.choice === "ai"}
                  onChange={() => handleChoiceChange("ai")}
                  className="w-4 h-4 text-indigo-600 bg-gray-800 border-gray-600 focus:ring-indigo-500 focus:ring-2"
                />
                <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
                  Use AI suggestion
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="radio"
                  name={`choice-${index}`}
                  checked={resolution.choice === "user"}
                  onChange={() => handleChoiceChange("user")}
                  className="w-4 h-4 text-indigo-600 bg-gray-800 border-gray-600 focus:ring-indigo-500 focus:ring-2"
                />
                <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
                  Use my custom rewrite
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer group">
                <input
                  type="radio"
                  name={`choice-${index}`}
                  checked={resolution.choice === "original"}
                  onChange={() => handleChoiceChange("original")}
                  className="w-4 h-4 text-indigo-600 bg-gray-800 border-gray-600 focus:ring-indigo-500 focus:ring-2"
                />
                <span className="text-sm text-gray-200 group-hover:text-white transition-colors">
                  Keep original
                </span>
              </label>
            </div>
          </div>

          {resolution.choice === "user" && (
            <div className="mt-4 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
              <h4 className="font-semibold text-gray-300 mb-3">
                Your Custom Rewrite
              </h4>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={userInputs[index] || ""}
                  onChange={(e) => {
                    handleUserInputChange(e.target.value);
                    // Prevent scroll to textarea
                    e.stopPropagation();
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                    // Prevent any parent scrolling
                    const scrollContainer = document.querySelector(
                      ".space-y-5"
                    ) as HTMLElement;
                    if (scrollContainer) {
                      scrollContainer.style.overflow = "visible";
                    }
                  }}
                  onBlur={(e) => {
                    e.stopPropagation();
                    // Restore scrolling
                    const scrollContainer = document.querySelector(
                      ".space-y-5"
                    ) as HTMLElement;
                    if (scrollContainer) {
                      scrollContainer.style.overflow = "auto";
                    }
                  }}
                  onKeyDown={(e) => {
                    // Prevent Enter key from causing page scroll
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Enter your preferred wording here..."
                  className="w-full p-3 bg-gray-900/70 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-white placeholder-gray-400 text-sm resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          {!resolution.isResolved && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => confirmChoice(index)}
                disabled={
                  resolution.choice === "user" && !userInputs[index]?.trim()
                }
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg disabled:shadow-none"
              >
                Confirm Choice
              </button>
            </div>
          )}

          {resolution.isResolved && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-md">
              <h5 className="font-semibold text-green-300 mb-1">
                Final Version
              </h5>
              <p className="text-sm text-gray-200">
                {getFinalText(clause, index)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">Negotiate</h3>
          <p className="text-gray-300 max-w-3xl">
            Review risky clauses, customize rewrites, and track your
            negotiations. Use the impact simulator to test scenarios.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="text-sm text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
              <button
                onClick={exportFinalPdf}
                disabled={!sourceFile || isBuilding}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-300 bg-indigo-900/40 border border-indigo-500/50 rounded-md hover:bg-indigo-900/70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isBuilding ? "Generating..." : "Export Negotiated PDF"}
              </button>
            </div>
            {sourceFile && (
              <p className="text-xs text-green-400">
                ✓ Ready to export: {sourceFile.name}
              </p>
            )}
            {!sourceFile && (
              <p className="text-xs text-gray-400">
                Upload the original PDF document to export with your changes
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-900/60 border border-gray-700/50 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("risks")}
          className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
            activeTab === "risks"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-gray-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          Risk Negotiation ({riskyClauses.length} clauses)
        </button>
        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
            activeTab === "simulator"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-gray-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          Impact Simulator
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "risks" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-white">
                Risky Clauses to Negotiate
              </h4>
              <p className="text-sm text-gray-400">
                {resolutions.filter((r) => r.isResolved).length} of{" "}
                {riskyClauses.length} clauses resolved
              </p>
            </div>
          </div>

          <div className="space-y-5">
            {riskyClauses.map((clause, index) => (
              <RiskClauseCard key={index} clause={clause} index={index} />
            ))}
          </div>
        </div>
      )}

      {activeTab === "simulator" && (
        <ImpactSimulatorView documentText={documentText} onError={onError} />
      )}
    </div>
  );
};

export default NegotiateView;
