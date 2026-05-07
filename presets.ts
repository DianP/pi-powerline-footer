import { getDefaultColors } from "./theme.js";
import type { ColorScheme, PresetDef, StatusLinePreset } from "./types.js";

// Get base colors from theme.ts (single source of truth)
const DEFAULT_COLORS: ColorScheme = getDefaultColors();

// Minimal - muted, less colorful, clean and unobtrusive
const MINIMAL_COLORS: ColorScheme = {
  ...DEFAULT_COLORS,
  model: "muted",
  path: "muted",
  gitClean: "dim",
  gitDirty: "muted",
  context: "dim",
  cost: "dim",
  tokens: "dim",
};

// Nerd - vibrant colors with high contrast
const NERD_COLORS: ColorScheme = {
  ...DEFAULT_COLORS,
  model: "accent",
  path: "success",
  gitDirty: "error",
  gitClean: "success",
  tokens: "text",
  cost: "warning",
  context: "muted",
};

export const PRESETS: Record<StatusLinePreset, PresetDef> = {
  default: {
    leftSegments: ["path", "git", "model", "thinking", "shell_mode"],
    rightSegments: ["token_in", "token_out", "context_pct", "cost"],
    separator: "dot",
    colors: DEFAULT_COLORS,
    segmentOptions: {
      model: { showThinkingLevel: false },
      path: { mode: "basename" },
      git: {
        showBranch: true,
        showStaged: true,
        showUnstaged: true,
        showUntracked: true,
      },
    },
  },

  minimal: {
    leftSegments: ["model", "path"],
    rightSegments: ["context_pct"],
    separator: "dot",
    colors: MINIMAL_COLORS,
    segmentOptions: {
      path: { mode: "basename" },
      git: {
        showBranch: true,
        showStaged: false,
        showUnstaged: false,
        showUntracked: false,
      },
    },
  },

  compact: {
    leftSegments: ["model", "shell_mode", "git"],
    rightSegments: ["cost", "context_pct"],
    separator: "dot",
    colors: DEFAULT_COLORS,
    segmentOptions: {
      model: { showThinkingLevel: false },
      git: {
        showBranch: true,
        showStaged: true,
        showUnstaged: true,
        showUntracked: false,
      },
    },
  },

  full: {
    leftSegments: [
      "path",
      "git",
      "model",
      "thinking",
      "shell_mode",
      "subagents",
    ],
    rightSegments: [
      "token_in",
      "token_out",
      "cache_read",
      "cache_write",
      "cache_rate",
      "token_rate",
      "context_pct",
      "cost",
      "time",
    ],
    separator: "dot",
    colors: DEFAULT_COLORS,
    segmentOptions: {
      model: { showThinkingLevel: false },
      path: { mode: "abbreviated", maxLength: 50 },
      git: {
        showBranch: true,
        showStaged: true,
        showUnstaged: true,
        showUntracked: true,
      },
      time: { format: "24h", showSeconds: false },
    },
  },

  nerd: {
    leftSegments: [
      "path",
      "git",
      "session",
      "model",
      "thinking",
      "shell_mode",
      "subagents",
    ],
    rightSegments: [
      "token_in",
      "token_out",
      "cache_read",
      "cache_write",
      "cache_rate",
      "token_rate",
      "context_pct",
      "cost",
      "time",
    ],
    separator: "dot",
    colors: NERD_COLORS,
    segmentOptions: {
      model: { showThinkingLevel: false },
      path: { mode: "abbreviated", maxLength: 60 },
      git: {
        showBranch: true,
        showStaged: true,
        showUnstaged: true,
        showUntracked: true,
      },
      time: { format: "24h", showSeconds: true },
    },
  },

  ascii: {
    leftSegments: ["model", "path", "git"],
    rightSegments: ["token_total", "cost", "context_pct"],
    separator: "ascii",
    colors: MINIMAL_COLORS,
    segmentOptions: {
      model: { showThinkingLevel: true },
      path: { mode: "abbreviated", maxLength: 40 },
      git: {
        showBranch: true,
        showStaged: true,
        showUnstaged: true,
        showUntracked: true,
      },
    },
  },

  custom: {
    leftSegments: ["path", "git", "model", "thinking", "shell_mode"],
    rightSegments: [
      "token_in",
      "token_out",
      "cache_read",
      "cache_write",
      "cache_rate",
      "context_pct",
      "cost",
      "time",
    ],
    separator: "dot",
    colors: DEFAULT_COLORS,
    segmentOptions: {},
  },
};

export function getPreset(name: StatusLinePreset): PresetDef {
  return PRESETS[name] ?? PRESETS.default;
}
