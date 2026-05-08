// Pre-test setup: create symlinks in the project's node_modules so that
// @earendil-works/* package specifiers resolve correctly during static import
// resolution and dynamic imports inside test functions.
//
// This runs via --import before any test file is loaded by the Node test runner.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

const globalModules = execSync("npm root -g", { encoding: "utf8" }).trim();
const scopeDir = join(process.cwd(), "node_modules", "@earendil-works");
mkdirSync(scopeDir, { recursive: true });

const agentDir = join(globalModules, "@earendil-works", "pi-coding-agent");

function resolveNested(name: string): string {
	// Try nested inside pi-coding-agent first (typical for npm dependency trees)
	const nested = join(agentDir, "node_modules", "@earendil-works", name);
	if (existsSync(nested)) return nested;
	// Try hoisted to top-level global node_modules
	const hoisted = join(globalModules, "@earendil-works", name);
	if (existsSync(hoisted)) return hoisted;
	throw new Error(
		`Cannot find @earendil-works/${name} — checked nested (${nested}) and hoisted (${hoisted})`,
	);
}

for (const name of ["pi-coding-agent", "pi-tui", "pi-ai"]) {
	const link = join(scopeDir, name);
	if (!existsSync(link)) {
		const target = name === "pi-coding-agent" ? agentDir : resolveNested(name);
		symlinkSync(target, link);
	}
}
