/**
 * @file ai-commit-helper.ts
 * @description Automated Conventional Commit message generator and git committer
 * powered by Google Gemini API and Bun native shell APIs.
 */

import { $ } from "bun";

/**
 * Generates an AI-assisted Conventional Commit message from staged git changes
 * and executes git commit with interactive or automated confirmation.
 * @returns Promise that resolves when commit completes or user aborts.
 * @throws {Error} If git commands or AI generation fail.
 */
export async function generateAiCommitMessage(): Promise<void> {
  console.log("🔍 Checking staged changes and code quality...");

  try {
    // 1. Enforce code formatting on staged files
    await $`bun fmt --staged`.quiet();

    // 2. Enforce strict native TypeScript type-safety
    await $`bun check -b`.quiet();
  } catch (qualityError) {
    console.error(
      "❌ Quality check failed before commit. Resolve formatting or typecheck errors first.",
    );
    if (qualityError instanceof Error) {
      console.error(qualityError.message);
    }
    process.exit(1);
  }

  // 3. Extract git diff for staged files
  const stagedDiff = (await $`git diff --staged --unified=2`.text()).trim();
  if (!stagedDiff) {
    console.error("⚠️ No staged changes found. Run 'git add <files>' before running commit:ai.");
    process.exit(1);
  }

  // 4. Validate AI provider credentials
  const apiKey = Bun.env.AI_PROVIDER_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "❌ Missing AI_PROVIDER_API_KEY environment variable. Set it in .env or your environment.",
    );
    process.exit(1);
  }

  const model = Bun.env.AI_COMMIT_MODEL?.trim() || "gemini-2.5-flash";

  console.log(`🤖 Analyzing staged diff via Gemini (${model})...`);

  const prompt = [
    "You are an expert civil engineering software engineer and git commit assistant.",
    "Generate a concise Conventional Commit message (e.g., feat, fix, perf, refactor, docs, test, chore).",
    "Scope must match the repository domain (e.g., scaffolding, mechanics, concrete, steel, canvas, pwa, analytics, scripts, types, config).",
    "Describe WHAT changed and WHY in imperative present tense.",
    "Output ONLY the raw commit message (one-line header, optional bullet body) without markdown fences or quotes.",
    "",
    "Staged Git Diff:",
    stagedDiff.slice(0, 16000),
  ].join("\n");

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 200,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const commitMessage = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!commitMessage) {
      throw new Error("Empty commit message candidate returned by Gemini API.");
    }

    console.log("\n========================================");
    console.log("Proposed Conventional Commit Message:");
    console.log("========================================");
    console.log(commitMessage);
    console.log("========================================\n");

    const isAutoMode = Bun.argv.includes("--auto");
    if (isAutoMode) {
      await $`git commit -m ${commitMessage}`;
      console.log("✅ Changes committed successfully (auto mode).");
      return;
    }

    process.stdout.write("Commit with this message? [Y/n]: ");
    for await (const line of console) {
      const answer = line.trim().toLowerCase();
      if (answer === "" || answer === "y" || answer === "yes") {
        await $`git commit -m ${commitMessage}`;
        console.log("✅ Changes committed successfully.");
      } else {
        console.log("🚫 Commit aborted by user.");
      }
      break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ AI commit generation failed: ${message}`);
    process.exit(1);
  }
}

// Run CLI if executed directly
if (import.meta.main) {
  await generateAiCommitMessage();
}
