import { RiskLevel } from "./types";

export const APP_NAME = "UnBind";

export const TABS = {
  RISK_ANALYSIS: "Risk Analysis",
  NEGOTIATE: "Negotiate",
  IMPACT_SIMULATOR: "Impact Simulator",
  KEY_TERMS_GLOSSARY: "Key Terms Glossary",
  KEY_DATES: "Key Dates",
};

export const RISK_COLORS: {
  [key in RiskLevel]: {
    text: string;
    bg: string;
    border: string;
    gradientFrom: string;
    gradientTo: string;
    glow: string;
  };
} = {
  [RiskLevel.High]: {
    text: "text-red-300",
    bg: "bg-red-900/20",
    border: "border-red-500/50",
    gradientFrom: "from-red-500/20",
    gradientTo: "to-gray-900/10",
    glow: "hover:shadow-red-500/20",
  },
  [RiskLevel.Medium]: {
    text: "text-yellow-300",
    bg: "bg-yellow-900/20",
    border: "border-yellow-500/50",
    gradientFrom: "from-yellow-500/20",
    gradientTo: "to-gray-900/10",
    glow: "hover:shadow-yellow-500/20",
  },
  [RiskLevel.Low]: {
    text: "text-green-300",
    bg: "bg-green-900/20",
    border: "border-green-500/50",
    gradientFrom: "from-green-500/20",
    gradientTo: "to-gray-900/10",
    glow: "hover:shadow-green-500/20",
  },
  [RiskLevel.Negligible]: {
    text: "text-blue-300",
    bg: "bg-blue-900/20",
    border: "border-blue-500/50",
    gradientFrom: "from-blue-500/20",
    gradientTo: "to-gray-900/10",
    glow: "hover:shadow-blue-500/20",
  },
  [RiskLevel.NoRisk]: {
    text: "text-gray-300",
    bg: "bg-gray-900/20",
    border: "border-gray-500/50",
    gradientFrom: "from-gray-500/20",
    gradientTo: "to-gray-900/10",
    glow: "hover:shadow-gray-500/20",
  },
};
