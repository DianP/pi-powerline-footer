/**
 * Theme system for powerline-footer
 * 
 * Colors are resolved in order:
 * 1. User overrides from theme.json (if exists)
 * 2. Preset colors
 * 3. Default colors
 */

import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ColorScheme, ColorValue, SemanticColor, ThemeLike } from "./types.ts";

export interface PowerlineThemeConfig {
  colors?: unknown;
  icons?: unknown;
}

// Default color scheme
// Uses pi theme tokens so the footer integrates with the active shell/terminal theme.
// Visual hierarchy: important info (model, path) is prominent, secondary info (tokens, cost) is subtle.
const DEFAULT_COLORS: Required<ColorScheme> = {
  model: "accent",         // Prominent — uses theme accent for the model name
  shellMode: "bashMode",   // Thematic — uses the shell mode color from the active theme
  path: "text",            // Clean, readable, adapts to any theme
  gitDirty: "warning",     // Standard warning for dirty state
  gitClean: "success",     // Standard success for clean state
  thinking: "thinkingOff",
  thinkingMinimal: "thinkingMinimal",
  thinkingLow: "thinkingLow",
  thinkingMedium: "thinkingMedium",
  context: "muted",        // Readable secondary info — more visible than "dim"
  contextWarn: "warning",
  contextError: "error",
  cost: "muted",           // Subtle — cost is secondary info
  tokens: "muted",         // Subtle — token counts are secondary info
  separator: "dim",        // Very subtle separators
  border: "borderMuted",   // Subtle border
  muted: "muted",          // Generic muted/secondary text — resolved from theme
  dim: "dim",              // Generic dim/subtle text — resolved from theme
};

// Rainbow colors for high thinking levels (Catppuccin Mocha gradient)
const RAINBOW_COLORS = [
  "#cba6f7", "#f5c2e7", "#f38ba8", "#fab387",
  "#f9e2af", "#a6e3a1", "#94e2d5", "#89b4fa",
];

// Default color scheme (Catppuccin Mocha) — used as hardcoded fallback when theme tokens resolve to empty
const FALLBACK_COLORS: Required<ColorScheme> = {
  model: "#cba6f7",  // Catppuccin Mocha Mauve
  shellMode: "accent",
  path: "#94e2d5",  // Catppuccin Mocha Teal
  gitDirty: "warning",
  gitClean: "success",
  thinking: "thinkingOff",
  thinkingMinimal: "thinkingMinimal",
  thinkingLow: "thinkingLow",
  thinkingMedium: "thinkingMedium",
  context: "dim",
  contextWarn: "warning",
  contextError: "error",
  cost: "text",
  tokens: "muted",
  separator: "dim",
  border: "borderMuted",
  muted: "muted",
  dim: "dim",
};

// Cache for user theme overrides
let userThemeCache: ColorScheme | null = null;
let userThemeCacheTime = 0;
let themeConfigCache: PowerlineThemeConfig | null = null;
let themeConfigCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds
const warnedInvalidThemeColors = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeUserThemeOverrides(value: unknown): ColorScheme {
  if (!isRecord(value)) {
    return {};
  }

  const sanitized: ColorScheme = {};
  for (const [key, rawColor] of Object.entries(value)) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_COLORS, key)) {
      continue;
    }
    if (typeof rawColor !== "string") {
      continue;
    }

    const color = rawColor.trim();
    if (!color) {
      continue;
    }

    sanitized[key as SemanticColor] = color as ColorValue;
  }

  return sanitized;
}

/**
 * Get the path to the theme.json file
 */
function getThemePath(): string {
  const extDir = dirname(fileURLToPath(import.meta.url));
  return join(extDir, "theme.json");
}

/**
 * Load user theme config from theme.json
 */
export function loadThemeConfig(): PowerlineThemeConfig {
  const now = Date.now();
  if (themeConfigCache && now - themeConfigCacheTime < CACHE_TTL) {
    return themeConfigCache;
  }

  const themePath = getThemePath();
  try {
    if (existsSync(themePath)) {
      const content = readFileSync(themePath, "utf-8");
      const parsed = JSON.parse(content);
      themeConfigCache = isRecord(parsed) ? parsed : {};
      themeConfigCacheTime = now;
      return themeConfigCache;
    }
  } catch (error) {
    // Theme overrides are optional. If the file is unreadable or malformed,
    // keep rendering with built-in defaults instead of breaking the footer.
    console.debug(`[powerline-theme] Failed to load ${themePath}:`, error);
  }

  themeConfigCache = {};
  themeConfigCacheTime = now;
  return themeConfigCache;
}

function loadUserTheme(): ColorScheme {
  const now = Date.now();
  if (userThemeCache && now - userThemeCacheTime < CACHE_TTL) {
    return userThemeCache;
  }

  userThemeCache = sanitizeUserThemeOverrides(loadThemeConfig().colors);
  userThemeCacheTime = now;
  return userThemeCache;
}

/**
 * Resolve a semantic color to an actual color value
 *
 * Priority: user overrides > preset colors > theme tokens > hardcoded fallback
 */
export function resolveColor(
  semantic: SemanticColor,
  presetColors?: ColorScheme
): ColorValue {
  const userTheme = loadUserTheme();
  
  return userTheme[semantic] 
    ?? presetColors?.[semantic] 
    ?? DEFAULT_COLORS[semantic]
    ?? FALLBACK_COLORS[semantic];
}

/**
 * Check if a color value is a hex color
 */
function isHexColor(color: ColorValue): color is `#${string}` {
  return typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color);
}

/**
 * Convert hex color to ANSI escape code
 */
function hexToAnsi(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/**
 * Apply a color to text using the pi theme or custom hex
 */
export function applyColor(
  theme: ThemeLike,
  color: ColorValue,
  text: string
): string {
  if (isHexColor(color)) {
    return `${hexToAnsi(color)}${text}\x1b[0m`;
  }

  try {
    return theme.fg(color as ThemeColor, text);
  } catch (error) {
    const key = String(color);
    if (!warnedInvalidThemeColors.has(key)) {
      warnedInvalidThemeColors.add(key);
      if (warnedInvalidThemeColors.size > 200) {
        warnedInvalidThemeColors.clear();
      }
      console.debug(`[powerline-theme] Invalid theme color "${key}"; falling back to "text".`, error);
    }
    return theme.fg("text", text);
  }
}

/**
 * Apply a semantic color to text
 */
export function fg(
  theme: ThemeLike,
  semantic: SemanticColor,
  text: string,
  presetColors?: ColorScheme
): string {
  const color = resolveColor(semantic, presetColors);
  return applyColor(theme, color, text);
}

/**
 * Apply rainbow gradient to text (for high thinking levels)
 */
export function rainbow(text: string): string {
  let result = "";
  let colorIndex = 0;
  for (const char of text) {
    if (char === " " || char === ":") {
      result += char;
    } else {
      result += hexToAnsi(RAINBOW_COLORS[colorIndex % RAINBOW_COLORS.length]) + char;
      colorIndex++;
    }
  }
  return result + "\x1b[0m";
}

/**
 * Get the default color scheme
 */
export function getDefaultColors(): Required<ColorScheme> {
  return { ...DEFAULT_COLORS };
}
