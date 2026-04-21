export const interpretConfidence = (score: number) => {
  if (score > 0.85) {
    return {
      level: "High model agreement",
      color: "normal" as const,
      note: "Consistent pattern detected across inference passes.",
    };
  }

  if (score > 0.6) {
    return {
      level: "Moderate model agreement",
      color: "attention" as const,
      note: "Pattern present - review alongside clinical context.",
    };
  }

  return {
    level: "Low model agreement",
    color: "attention" as const,
    note: "Ambiguous result - do not draw conclusions from this scan alone.",
  };
};
