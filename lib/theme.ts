export const labTheme = {
  colors: {
    canvas: {
      from: "#020617",
      via: "#0f172a",
      to: "#020617",
    },
    text: {
      primary: "#f8fafc",
      muted: "#94a3b8",
    },
    border: {
      strong: "rgba(255,255,255,0.10)",
      soft: "rgba(255,255,255,0.05)",
    },
    surface: {
      frosted: "rgba(255,255,255,0.04)",
      base: "rgba(255,255,255,0.05)",
      muted: "rgba(0,0,0,0.40)",
    },
    accent: "#34d399",
    danger: "#fb7185",
    warning: "#fbbf24",
  },
  radii: {
    shell: "24px",
    panel: "28px",
    card: "16px",
    bubble: "24px",
    pill: "9999px",
    modal: "24px",
  },
  shadows: {
    panel: "0 0 80px rgba(15,23,42,0.65)",
    modal: "0 0 60px rgba(15,23,42,0.70)",
  },
  gradients: {
    canvas:
      "linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)",
  },
} as const;
