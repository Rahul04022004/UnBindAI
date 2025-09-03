import React, { useState } from "react";
import type { AnalysisResponse } from "../types";

interface OverlayRephrasedPdfProps {
  analysisResult: AnalysisResponse;
}

// Best-effort overlay-based rephrasing: we render a text-only PDF using pdf-lib,
// preserving page count and basic layout spacing. True pixel-perfect replacement
// of original fonts/kerning is non-trivial without full PDF text positioning.
// This provides a practical "same pages, rephrased text" export without touching existing flows.
const OverlayRephrasedPdf: React.FC<OverlayRephrasedPdfProps> = ({
  analysisResult,
}) => {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setSourceFile(f);
  };

  const buildRephrasedText = (): string => {
    return analysisResult.clauses
      .map((c, i) => {
        const body =
          c.suggestedRewrite && c.suggestedRewrite.trim()
            ? c.suggestedRewrite.trim()
            : c.clauseText.trim();
        return `Clause ${i + 1}:\n${body}`;
      })
      .join("\n\n");
  };

  const exportOverlay = async () => {
    if (!sourceFile) return;
    try {
      setIsBuilding(true);
      // @ts-ignore
      const { PDFDocument, StandardFonts, rgb } = window.PDFLib || {};
      // @ts-ignore
      const pdfjsLib = (window as any).pdfjsLib;
      if (!PDFDocument || !pdfjsLib)
        throw new Error("pdf-lib or pdf.js not available");

      const bytes = await sourceFile.arrayBuffer();
      // Extract text page-by-page using pdf.js
      const loadingTask = pdfjsLib.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;
      const normalizeSpaces = (s: string) => s.replace(/\s+/g, " ").trim();
      const pageTexts: string[] = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        // @ts-ignore
        const textContent = await page.getTextContent();
        type Item = { str: string; x: number; y: number; height: number };
        const items: Item[] = textContent.items.map((it: any) => {
          const t = it.transform; // [a,b,c,d,e,f]
          const height = Math.hypot(t[2], t[3]);
          const x = t[4];
          // flip to a top-down coordinate for grouping only
          const viewport = page.getViewport({ scale: 1.0 });
          const y = viewport.height - t[5];
          return { str: it.str, x, y, height };
        });

        // Group into lines by similar y (tolerance)
        const tol = 2; // pixels
        const linesMap: Map<number, Item[]> = new Map();
        for (const it of items) {
          let key: number | null = null;
          for (const k of linesMap.keys()) {
            if (Math.abs(k - it.y) <= tol) {
              key = k;
              break;
            }
          }
          const useKey = key ?? it.y;
          const arr = linesMap.get(useKey) || [];
          arr.push(it);
          linesMap.set(useKey, arr);
        }
        const lineYs = Array.from(linesMap.keys()).sort((a, b) => a - b); // top to bottom
        const lines: { y: number; text: string; height: number }[] = lineYs.map(
          (y) => {
            const arr = linesMap.get(y) || [];
            arr.sort((a, b) => a.x - b.x);
            const text = normalizeSpaces(arr.map((a) => a.str).join(" "));
            const avgH = arr.length
              ? arr.reduce((s, a) => s + a.height, 0) / arr.length
              : 12;
            return { y, text, height: avgH };
          }
        );

        // Build paragraphs by detecting large vertical gaps
        const out: string[] = [];
        let prevY: number | null = null;
        let prevH: number = 12;
        for (const ln of lines) {
          if (prevY !== null) {
            const gap = ln.y - prevY;
            if (gap > prevH * 1.8) {
              out.push(""); // paragraph break (extra blank line)
            }
          }
          out.push(ln.text);
          prevY = ln.y;
          prevH = ln.height || prevH;
        }
        pageTexts.push(out.join("\n"));
      }

      // Build a single text body separated by paragraphs per page
      let combined = pageTexts.join("\n\n");

      // Apply clause-level rewrites on the combined normalized text
      const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const clauses = analysisResult.clauses.map((c) => ({
        original: normalizeSpaces(c.clauseText),
        rewrite: normalizeSpaces(
          c.suggestedRewrite && c.suggestedRewrite.trim()
            ? c.suggestedRewrite
            : c.clauseText
        ),
      }));
      for (const cl of clauses) {
        if (!cl.original) continue;
        const parts = cl.original.split(" ");
        const rx = new RegExp(parts.map(escapeRx).join("\\s+"));
        if (rx.test(combined)) {
          combined = combined.replace(rx, cl.rewrite);
        }
      }

      // Create a new PDF with the same page sizes and flow the modified text across pages
      const srcDoc = await PDFDocument.load(bytes);
      const outDoc = await PDFDocument.create();
      const font = await outDoc.embedFont(StandardFonts.Helvetica);
      const pages = srcDoc.getPages();
      const newPages = pages.map((p) => {
        const { width, height } = p.getSize();
        return outDoc.addPage([width, height]);
      });
      const margin = 48;
      const lineHeight = 14;
      const fontSize = 10.5;
      const color = rgb(0.15, 0.17, 0.2);
      let pageIdx = 0;
      let y = newPages[0].getHeight() - margin;
      const currentPage = () => newPages[pageIdx];

      const maxWidth = () => currentPage().getWidth() - margin * 2;
      const measure = (s: string) => font.widthOfTextAtSize(s, fontSize);
      const wrap = (text: string): string[] => {
        const tokens = text.split(/\s+/);
        const lines: string[] = [];
        let line = "";
        tokens.forEach((tok) => {
          const test = line ? line + " " + tok : tok;
          if (measure(test) > maxWidth()) {
            if (line) lines.push(line);
            line = tok;
          } else {
            line = test;
          }
        });
        if (line) lines.push(line);
        return lines;
      };

      const writeLine = (text: string) => {
        if (y < margin + lineHeight) {
          pageIdx = Math.min(pageIdx + 1, newPages.length - 1);
          y = currentPage().getHeight() - margin;
        }
        currentPage().drawText(text, {
          x: margin,
          y,
          size: fontSize,
          font,
          color,
        });
        y -= lineHeight;
      };

      // Title
      currentPage().drawText("UnBind: Balanced Rephrased Contract", {
        x: margin,
        y,
        size: 12,
        font,
        color,
      });
      y -= lineHeight + 6;

      const paragraphs = combined.split(/\n\n+/);
      for (const par of paragraphs) {
        const rawLines = par.split(/\n/);
        for (const raw of rawLines) {
          const wrapped = wrap(raw);
          for (const l of wrapped) writeLine(l);
        }
        y -= 6;
      }

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "UnBind-Balanced-Rephrased-from-Extracted.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to generate rephrased PDF from extracted text.");
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <div className="p-4 rounded-lg border border-indigo-500/20 bg-gray-800/30 space-y-3">
      <h4 className="font-semibold text-indigo-300">
        Overlay Rephrased PDF (Beta)
      </h4>
      <p className="text-sm text-gray-300">
        Upload the original PDF to export a rephrased PDF that mirrors the
        original page sizes while inserting the balanced text.
      </p>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        className="text-sm text-gray-200"
      />
      <button
        type="button"
        onClick={exportOverlay}
        disabled={!sourceFile || isBuilding}
        className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-300 bg-indigo-900/40 border border-indigo-500/50 rounded-md hover:bg-indigo-900/70 disabled:opacity-50 transition-colors"
      >
        {isBuilding ? "Generating…" : "Export Rephrased (Overlay)"}
      </button>
    </div>
  );
};

export default OverlayRephrasedPdf;
