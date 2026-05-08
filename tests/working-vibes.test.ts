import test from "node:test";
import assert from "node:assert/strict";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FAUX_PROVIDER_SPEC = join(
	realpathSync(join(process.cwd(), "node_modules", "@earendil-works", "pi-ai")),
	"dist/providers/faux.js",
);

test("generateVibesBatch includes a system prompt so faux providers can return text", async () => {
	const home = mkdtempSync(join(tmpdir(), "powerline-vibes-home-"));
	const previousHome = process.env.HOME;
	process.env.HOME = home;

	try {
		const { fauxAssistantMessage, registerFauxProvider } = await import(
			FAUX_PROVIDER_SPEC
		);
		const { generateVibesBatch, initVibeManager, setVibeModel } = await import(
			"../working-vibes.ts"
		);

		const registration = registerFauxProvider({
			provider: "test-provider",
			models: [{ id: "test-model" }],
		});

		try {
			const model = registration.getModel("test-model");
			assert.ok(model);

			registration.setResponses([
				(context) => {
					assert.match(context.systemPrompt ?? "", /loading messages/i);
					return fauxAssistantMessage(
						"Engaging warp drive...\nRunning diagnostics...",
					);
				},
			]);

			initVibeManager({
				modelRegistry: {
					find(provider: string, modelId: string) {
						return provider === "test-provider" && modelId === "test-model"
							? model
							: undefined;
					},
					async getApiKeyAndHeaders() {
						return { ok: true, apiKey: "test-key", headers: {} };
					},
				},
			});

			assert.equal(setVibeModel("test-provider/test-model"), true);

			const result = await generateVibesBatch("star trek", 2);

			assert.equal(result.success, true);
			assert.equal(result.count, 2);
			assert.equal(existsSync(result.filePath), true);
			assert.deepEqual(
				readFileSync(result.filePath, "utf8").trim().split("\n"),
				["Engaging warp drive...", "Running diagnostics..."],
			);
		} finally {
			registration.unregister();
		}
	} finally {
		if (previousHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = previousHome;
		}
		rmSync(home, { recursive: true, force: true });
	}
});

test("on-demand vibe generation includes a system prompt for providers that require instructions", async () => {
	const home = mkdtempSync(join(tmpdir(), "powerline-vibes-home-"));
	const previousHome = process.env.HOME;
	process.env.HOME = home;

	try {
		const { fauxAssistantMessage, registerFauxProvider } = await import(
			FAUX_PROVIDER_SPEC
		);
		const {
			initVibeManager,
			onVibeAgentStart,
			onVibeBeforeAgentStart,
			setVibeModel,
			setVibeTheme,
		} = await import("../working-vibes.ts");

		const registration = registerFauxProvider({
			provider: "test-provider",
			models: [{ id: "test-model" }],
		});

		try {
			const model = registration.getModel("test-model");
			assert.ok(model);

			registration.setResponses([
				(context) => {
					assert.match(context.systemPrompt ?? "", /loading messages/i);
					return fauxAssistantMessage("Engaging warp drive...");
				},
			]);

			initVibeManager({
				modelRegistry: {
					find(provider: string, modelId: string) {
						return provider === "test-provider" && modelId === "test-model"
							? model
							: undefined;
					},
					async getApiKeyAndHeaders() {
						return { ok: true, apiKey: "test-key", headers: {} };
					},
				},
			});

			assert.equal(setVibeTheme("star trek"), true);
			assert.equal(setVibeModel("test-provider/test-model"), true);

			const updates: Array<string | undefined> = [];
			onVibeAgentStart();
			onVibeBeforeAgentStart("fix a bug", (message) => {
				updates.push(message);
			});

			const start = Date.now();
			while (
				!updates.includes("Engaging warp drive...") &&
				Date.now() - start < 1000
			) {
				await new Promise((resolve) => setTimeout(resolve, 10));
			}

			assert.equal(updates[0], "Channeling star trek...");
			assert.ok(updates.includes("Engaging warp drive..."));
		} finally {
			registration.unregister();
		}
	} finally {
		if (previousHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = previousHome;
		}
		rmSync(home, { recursive: true, force: true });
	}
});

test("generateVibesBatch preserves provider errors instead of reporting an empty response", async () => {
	const home = mkdtempSync(join(tmpdir(), "powerline-vibes-home-"));
	const previousHome = process.env.HOME;
	process.env.HOME = home;

	try {
		const { fauxAssistantMessage, registerFauxProvider } = await import(
			FAUX_PROVIDER_SPEC
		);
		const { generateVibesBatch, initVibeManager, setVibeModel } = await import(
			"../working-vibes.ts"
		);

		const registration = registerFauxProvider({
			provider: "test-provider",
			models: [{ id: "test-model" }],
		});

		try {
			const model = registration.getModel("test-model");
			assert.ok(model);

			registration.setResponses([
				fauxAssistantMessage([], {
					stopReason: "error",
					errorMessage: "Instructions are required",
				}),
			]);

			initVibeManager({
				modelRegistry: {
					find(provider: string, modelId: string) {
						return provider === "test-provider" && modelId === "test-model"
							? model
							: undefined;
					},
					async getApiKeyAndHeaders() {
						return { ok: true, apiKey: "test-key", headers: {} };
					},
				},
			});

			assert.equal(setVibeModel("test-provider/test-model"), true);

			const result = await generateVibesBatch("noir", 2);

			assert.equal(result.success, false);
			assert.equal(result.error, "Instructions are required");
		} finally {
			registration.unregister();
		}
	} finally {
		if (previousHome === undefined) {
			delete process.env.HOME;
		} else {
			process.env.HOME = previousHome;
		}
		rmSync(home, { recursive: true, force: true });
	}
});
