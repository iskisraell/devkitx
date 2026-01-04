/**
 * docs command - Open documentation for various tools
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  resolveDocUrl,
  getAvailableTopics,
  getTopicSections,
  searchDocs,
} from "../lib/docs-registry.js";
import { openUrl } from "../lib/browser.js";
import * as ui from "../ui/theme.js";

export const docsCommand = new Command("docs")
  .description("Open documentation for your stack")
  .argument(
    "[topic]",
    "Documentation topic (e.g., next, shadcn/button, convex/queries)",
  )
  .option("-l, --list", "List all available topics")
  .option("-s, --search <query>", "Search across all documentation")
  .option("--sections", "Show available sections for a topic")
  .action(
    async (
      topic: string | undefined,
      options: { list?: boolean; search?: string; sections?: boolean },
    ) => {
      // List all topics
      if (options.list) {
        ui.header("Available Documentation Topics");
        const topics = getAvailableTopics();

        const categories: Record<string, string[]> = {
          "Frontend Frameworks": ["next", "nextjs", "vite", "react"],
          Mobile: ["expo", "react-native", "nativewind"],
          "UI Libraries": ["shadcn", "tailwind"],
          Backend: ["convex", "supabase"],
          "Monorepo & Build": ["turbo", "turborepo"],
          Deployment: ["vercel"],
          "Package Managers": ["pnpm", "bun"],
          Testing: ["vitest", "playwright"],
          TypeScript: ["typescript", "ts", "zod"],
          "State Management": ["tanstack", "react-query", "zustand"],
        };

        for (const [category, catTopics] of Object.entries(categories)) {
          console.log();
          console.log(ui.theme.bold(category));
          for (const t of catTopics) {
            if (topics.includes(t)) {
              const sections = getTopicSections(t);
              if (sections.length > 0) {
                console.log(
                  `  ${ui.theme.primary(t)} ${ui.theme.muted(`(${sections.length} sections)`)}`,
                );
              } else {
                console.log(`  ${ui.theme.primary(t)}`);
              }
            }
          }
        }

        ui.spacer();
        console.log(
          ui.theme.muted("Usage: dx docs <topic> or dx docs <topic>/<section>"),
        );
        console.log(ui.theme.muted("Example: dx docs shadcn/button"));
        return;
      }

      // Search across docs
      if (options.search) {
        ui.header(`Search Results for "${options.search}"`);
        const results = searchDocs(options.search);

        if (results.length === 0) {
          ui.warning("No results found");
          return;
        }

        for (const result of results.slice(0, 15)) {
          if (result.section) {
            console.log(
              `  ${ui.theme.primary(result.topic)}/${ui.theme.white(result.section)}`,
            );
          } else {
            console.log(`  ${ui.theme.primary(result.topic)}`);
          }
          console.log(`    ${ui.theme.muted(result.url)}`);
        }

        if (results.length > 15) {
          ui.spacer();
          console.log(
            ui.theme.muted(`... and ${results.length - 15} more results`),
          );
        }
        return;
      }

      // Show sections for a topic
      if (options.sections && topic) {
        const sections = getTopicSections(topic);
        if (sections.length === 0) {
          ui.warning(`No sections available for "${topic}"`);
          return;
        }

        ui.header(`Sections for ${topic}`);
        for (const section of sections) {
          console.log(
            `  ${ui.theme.primary(topic)}/${ui.theme.white(section)}`,
          );
        }
        return;
      }

      // No topic provided
      if (!topic) {
        console.log(
          chalk.yellow(
            "Please provide a topic or use --list to see available topics",
          ),
        );
        console.log();
        console.log("Examples:");
        console.log(
          `  ${chalk.cyan("dx docs next")}           Open Next.js docs`,
        );
        console.log(
          `  ${chalk.cyan("dx docs next/routing")}   Open Next.js routing docs`,
        );
        console.log(
          `  ${chalk.cyan("dx docs shadcn/button")}  Open shadcn Button component`,
        );
        console.log(
          `  ${chalk.cyan("dx docs --list")}         List all topics`,
        );
        console.log(
          `  ${chalk.cyan("dx docs --search auth")}  Search for auth-related docs`,
        );
        return;
      }

      // Resolve and open URL
      const url = resolveDocUrl(topic);
      if (!url) {
        ui.error(`Unknown topic: ${topic}`);
        console.log();
        console.log(
          `Run ${chalk.cyan("dx docs --list")} to see available topics`,
        );
        console.log(`Run ${chalk.cyan("dx docs --search " + topic)} to search`);
        return;
      }

      ui.info(`Opening ${chalk.white(topic)} documentation...`);
      console.log(ui.theme.muted(`  ${url}`));
      await openUrl(url);
    },
  );
