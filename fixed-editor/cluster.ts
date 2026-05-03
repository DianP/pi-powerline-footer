import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export const CURSOR_MARKER = "\x1b_pi:c\x07";

export interface FixedEditorClusterInput {
  width: number;
  terminalRows: number;
  statusLines?: string[];
  topLines?: string[];
  editorLines: string[];
  secondaryLines?: string[];
  transcriptLines?: string[];
  lastPromptLines?: string[];
  bottomStatusLines?: string[];
  bottomBarRightLines?: string[];
}

export interface FixedEditorCursor {
  row: number;
  col: number;
}

export interface FixedEditorClusterRender {
  lines: string[];
  cursor: FixedEditorCursor | null;
}

function normalizeLines(lines: string[] | undefined, width: number): string[] {
  if (!lines || width <= 0) return [];

  return lines
    .filter((line) => line !== undefined && line !== null)
    .map((line) => visibleWidth(line) > width ? truncateToWidth(line, width, "", true) : line);
}

function takeTail(lines: string[], count: number): string[] {
  if (count <= 0) return [];
  return lines.length <= count ? lines : lines.slice(lines.length - count);
}

function stripAnsi(line: string): string {
  return line.replace(/\x1b\[[0-9;]*m/g, "");
}

function isEditorBorderLine(line: string): boolean {
  return /^─{3,}/.test(stripAnsi(line).trimStart());
}

function getEditorBorderIndices(lines: string[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isEditorBorderLine(lines[i] ?? "")) {
      indices.push(i);
    }
  }
  return indices;
}

function getFocusedEditorRow(lines: string[], start: number, end: number): number {
  const cursorRow = lines.findIndex((line) => line.includes(CURSOR_MARKER));
  if (cursorRow > start && cursorRow < end) return cursorRow;

  const selectedRow = lines.findIndex((line) => stripAnsi(line).trimStart().startsWith("→ "));
  if (selectedRow > start && selectedRow < end) return selectedRow;

  return start + 1;
}

function mergeBottomStatusAndLastPrompt(statusLine: string, lastPromptLine: string, width: number): string {
  const status = statusLine.trim();
  const lastPrompt = lastPromptLine.trim();
  if (!status) return truncateToWidth(` ${lastPrompt}`, width, "…");
  if (!lastPrompt) return truncateToWidth(` ${status}`, width, "…");

  const separator = "  ";
  const statusWidth = visibleWidth(status);
  const separatorWidth = visibleWidth(separator);
  // Account for leading space
  if (statusWidth + separatorWidth >= width - 1) {
    return truncateToWidth(` ${status}`, width, "…");
  }

  return ` ${status}${separator}${truncateToWidth(lastPrompt, width - 1 - statusWidth - separatorWidth, "…")}`;
}

function mergeBottomBarRow(leftLine: string, rightLine: string, width: number): string {
  const left = leftLine.trim();
  const right = rightLine.trim();
  if (!left) return truncateToWidth(` ${right} `, width, "…");
  if (!right) return truncateToWidth(` ${left} `, width, "…");

  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const minGap = 2;
  const availableWidth = width - 2; // 1 leading + 1 trailing space

  if (leftWidth + minGap + rightWidth > availableWidth) {
    const availableRight = Math.max(0, availableWidth - leftWidth - minGap);
    if (availableRight > 0) {
      const truncatedRight = truncateToWidth(right, availableRight, "…");
      const gap = availableWidth - leftWidth - visibleWidth(truncatedRight);
      return ` ${left}${" ".repeat(Math.max(minGap, gap))}${truncatedRight} `;
    }
    return truncateToWidth(` ${left} `, width, "…");
  }

  const gap = availableWidth - leftWidth - rightWidth;
  return ` ${left}${" ".repeat(gap)}${right} `;
}

function buildBottomBarLines(
  bottomStatusLines: string[],
  lastPromptLines: string[],
  bottomBarRightLines: string[],
  width: number,
): {
  bottomBarLines: string[];
  regularLastPromptLines: string[];
} {
  const hasRightContent = bottomBarRightLines.length > 0;

  if (!hasRightContent) {
    if (bottomStatusLines.length === 0 || lastPromptLines.length === 0) {
      return {
        bottomBarLines: bottomStatusLines.map((line) => {
          const trimmed = line.trimStart();
          return trimmed ? ` ${trimmed}` : line;
        }),
        regularLastPromptLines: lastPromptLines,
      };
    }

    const statusHead = bottomStatusLines.slice(0, -1);
    const lastPromptHead = lastPromptLines.slice(0, -1);
    const statusTail = bottomStatusLines[bottomStatusLines.length - 1] ?? "";
    const lastPromptTail = lastPromptLines[lastPromptLines.length - 1] ?? "";

    return {
      bottomBarLines: [
        ...statusHead.map((line) => {
          const trimmed = line.trimStart();
          return trimmed ? ` ${trimmed}` : line;
        }),
        mergeBottomStatusAndLastPrompt(statusTail, lastPromptTail, width),
      ],
      regularLastPromptLines: lastPromptHead,
    };
  }

  // Merge left side (status + last prompt) and right side (extension statuses)
  const statusTail = bottomStatusLines[bottomStatusLines.length - 1] ?? "";
  const lastPromptTail = lastPromptLines[lastPromptLines.length - 1] ?? "";
  const rightTail = bottomBarRightLines[bottomBarRightLines.length - 1] ?? "";

  const leftMerged = mergeBottomStatusAndLastPrompt(statusTail, lastPromptTail, width);

  const bottomBarLines: string[] = [
    ...bottomStatusLines.slice(0, -1).map((line) => {
      const trimmed = line.trimStart();
      return trimmed ? ` ${trimmed}` : line;
    }),
    ...bottomBarRightLines.slice(0, -1),
  ];

  if (leftMerged || rightTail) {
    bottomBarLines.push(mergeBottomBarRow(leftMerged, rightTail, width));
  }

  return {
    bottomBarLines,
    regularLastPromptLines: lastPromptLines.slice(0, -1),
  };
}

function capEditorLines(lines: string[], count: number): string[] {
  if (count <= 0) return [];
  if (lines.length <= count) return lines;

  const borderIndices = getEditorBorderIndices(lines);
  if (count >= 3 && borderIndices.length >= 2 && borderIndices[0] === 0) {
    const bottomBorderIndex = borderIndices[borderIndices.length - 1];
    const innerCount = count - 2;
    const innerLines = lines.slice(1, bottomBorderIndex);
    const focusedRow = getFocusedEditorRow(lines, 0, bottomBorderIndex) - 1;
    const start = Math.max(0, Math.min(focusedRow - innerCount + 1, innerLines.length - innerCount));
    return [lines[0], ...innerLines.slice(start, start + innerCount), lines[bottomBorderIndex]];
  }

  const cursorRow = lines.findIndex((line) => line.includes(CURSOR_MARKER));
  if (cursorRow !== -1) {
    const start = Math.max(0, Math.min(cursorRow - count + 1, lines.length - count));
    return lines.slice(start, start + count);
  }

  const selectedRow = lines.findIndex((line) => stripAnsi(line).trimStart().startsWith("→ "));
  if (selectedRow === -1) {
    return lines.slice(0, count);
  }

  const start = Math.max(0, Math.min(selectedRow - Math.floor(count / 2), lines.length - count));
  return lines.slice(start, start + count);
}

function extractCursor(lines: string[]): FixedEditorClusterRender {
  let cursor: FixedEditorCursor | null = null;
  const cleaned = lines.map((line, row) => {
    const markerIndex = line.indexOf(CURSOR_MARKER);
    if (markerIndex === -1) return line;

    if (!cursor) {
      cursor = {
        row,
        col: visibleWidth(line.slice(0, markerIndex)),
      };
    }

    return line.slice(0, markerIndex) + line.slice(markerIndex + CURSOR_MARKER.length);
  });

  return { lines: cleaned, cursor };
}

export function renderFixedEditorCluster(input: FixedEditorClusterInput): FixedEditorClusterRender {
  const width = Math.max(1, input.width);
  const maxRows = Math.max(1, input.terminalRows - 1);

  const statusLines = normalizeLines(input.statusLines, width);
  const topLines = normalizeLines(input.topLines, width);
  const editorSource = normalizeLines(input.editorLines, width);
  const secondaryLines = normalizeLines(input.secondaryLines, width);
  const transcriptLines = normalizeLines(input.transcriptLines, width);
  const lastPromptLines = normalizeLines(input.lastPromptLines, width);
  const bottomStatusLines = normalizeLines(input.bottomStatusLines, width);
  const bottomBarRightLines = normalizeLines(input.bottomBarRightLines, width);
  const { bottomBarLines, regularLastPromptLines } = buildBottomBarLines(bottomStatusLines, lastPromptLines, bottomBarRightLines, width);

  const editorLines = capEditorLines(editorSource, maxRows);
  let remaining = maxRows - editorLines.length;

  const bottomBar = takeTail(bottomBarLines, remaining);
  remaining -= bottomBar.length;

  const top = takeTail(topLines, remaining);
  remaining -= top.length;

  const secondary = takeTail(secondaryLines, remaining);
  remaining -= secondary.length;

  const lastPrompt = takeTail(regularLastPromptLines, remaining);
  remaining -= lastPrompt.length;

  const status = takeTail(statusLines, remaining);
  remaining -= status.length;

  const transcript = takeTail(transcriptLines, remaining);

  return extractCursor([
    ...status,
    ...top,
    ...editorLines,
    ...secondary,
    ...transcript,
    ...lastPrompt,
    ...bottomBar,
  ]);
}
