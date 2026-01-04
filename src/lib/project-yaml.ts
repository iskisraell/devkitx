/**
 * Project YAML Parser/Writer
 * Handles project.yaml for DevKitX projects
 */

import { parse, stringify } from "yaml";
import { existsSync } from "fs";
import { join } from "path";

export interface ProjectConfig {
  project: {
    name: string;
    description: string;
    created: string;
    version: string;
  };
  stack: {
    monorepo?: string;
    package_manager: string;
    apps: Record<string, AppConfig>;
    backend?: BackendConfig;
    packages?: PackageConfig[];
  };
  architecture?: {
    description?: string;
    data_flow?: string;
    key_decisions?: string[];
  };
  features?: {
    implemented?: string[];
    in_progress?: string[];
    planned?: string[];
  };
  agent_notes?: {
    last_session?: string;
    context?: string;
    todos?: string[];
    conventions?: string[];
  };
}

export interface AppConfig {
  framework: string;
  path: string;
  features?: string[];
  port?: number;
}

export interface BackendConfig {
  primary: string;
  secondary?: string;
  features?: string[];
}

export interface PackageConfig {
  name: string;
  path: string;
  description: string;
}

const PROJECT_YAML_FILENAME = "project.yaml";

/**
 * Find project.yaml in current or parent directories
 */
export function findProjectYaml(
  startDir: string = process.cwd(),
): string | null {
  let currentDir = startDir;
  let previousDir = "";
  let maxIterations = 50; // Safety limit

  while (currentDir !== previousDir && maxIterations > 0) {
    maxIterations--;
    const yamlPath = join(currentDir, PROJECT_YAML_FILENAME);
    if (existsSync(yamlPath)) {
      return yamlPath;
    }
    previousDir = currentDir;
    currentDir = join(currentDir, "..");
  }

  return null;
}

/**
 * Read and parse project.yaml
 */
export async function readProjectConfig(
  path?: string,
): Promise<ProjectConfig | null> {
  const yamlPath = path || findProjectYaml();
  if (!yamlPath || !existsSync(yamlPath)) {
    return null;
  }

  try {
    const content = await Bun.file(yamlPath).text();
    return parse(content) as ProjectConfig;
  } catch {
    return null;
  }
}

/**
 * Write project.yaml
 */
export async function writeProjectConfig(
  config: ProjectConfig,
  path: string,
): Promise<void> {
  const yamlContent = stringify(config, {
    lineWidth: 100,
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE",
  });

  await Bun.write(path, yamlContent);
}

/**
 * Create initial project.yaml
 */
export function createProjectConfig(options: {
  name: string;
  description?: string;
  template: "turbo-monorepo" | "next-only" | "vite-only";
  backend?: "convex" | "supabase" | "both" | "none";
  features?: string[];
}): ProjectConfig {
  const now = new Date().toISOString().split("T")[0];

  const config: ProjectConfig = {
    project: {
      name: options.name,
      description:
        options.description || `A modern web application built with DevKitX`,
      created: now,
      version: "0.1.0",
    },
    stack: {
      package_manager: "pnpm",
      apps: {},
    },
    architecture: {
      description: "",
      key_decisions: [],
    },
    features: {
      implemented: [],
      in_progress: [],
      planned: [],
    },
    agent_notes: {
      last_session: now,
      context: "Initial project setup",
      todos: [],
      conventions: [],
    },
  };

  // Configure based on template
  switch (options.template) {
    case "turbo-monorepo":
      config.stack.monorepo = "turborepo";
      config.stack.apps = {
        web: {
          framework: "next.js@15",
          path: "apps/web",
          features: [
            "app-router",
            "server-components",
            "shadcn-ui",
            "tailwind",
          ],
          port: 3000,
        },
        mobile: {
          framework: "expo@52",
          path: "apps/mobile",
          features: ["expo-router", "nativewind"],
        },
      };
      config.stack.packages = [
        {
          name: "@repo/ui",
          path: "packages/ui",
          description: "Shared UI components (web)",
        },
        {
          name: "@repo/shared",
          path: "packages/shared",
          description: "Shared utilities and types",
        },
        {
          name: "@repo/config-tailwind",
          path: "packages/config-tailwind",
          description: "Shared Tailwind config",
        },
        {
          name: "@repo/config-typescript",
          path: "packages/config-typescript",
          description: "Shared TS config",
        },
      ];
      config.architecture!.description =
        "Turborepo monorepo with Next.js web app and Expo mobile app sharing business logic";
      break;

    case "next-only":
      config.stack.apps = {
        web: {
          framework: "next.js@15",
          path: ".",
          features: [
            "app-router",
            "server-components",
            "shadcn-ui",
            "tailwind",
          ],
          port: 3000,
        },
      };
      config.architecture!.description = "Next.js application with App Router";
      break;

    case "vite-only":
      config.stack.apps = {
        web: {
          framework: "vite@6",
          path: ".",
          features: ["react", "shadcn-ui", "tailwind"],
          port: 5173,
        },
      };
      config.architecture!.description = "Vite + React application";
      break;
  }

  // Configure backend
  if (options.backend && options.backend !== "none") {
    config.stack.backend = {
      primary: options.backend === "both" ? "convex" : options.backend,
      secondary: options.backend === "both" ? "supabase" : undefined,
      features: [],
    };

    if (options.backend === "convex" || options.backend === "both") {
      config.stack.backend.features!.push("realtime", "functions");
    }
    if (options.backend === "supabase" || options.backend === "both") {
      config.stack.backend.features!.push("auth", "database", "storage");
    }
  }

  return config;
}
