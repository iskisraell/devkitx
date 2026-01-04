/**
 * Documentation Registry - Maps topics to URLs
 */

export interface DocEntry {
  base: string;
  sections?: Record<string, string>;
}

export const docsRegistry: Record<string, DocEntry> = {
  // Frontend Frameworks
  next: {
    base: "https://nextjs.org/docs",
    sections: {
      routing: "/app/building-your-application/routing",
      "app-router": "/app",
      "pages-router": "/pages",
      api: "/app/building-your-application/routing/route-handlers",
      "server-actions":
        "/app/building-your-application/data-fetching/server-actions-and-mutations",
      "server-components":
        "/app/building-your-application/rendering/server-components",
      metadata: "/app/building-your-application/optimizing/metadata",
      images: "/app/building-your-application/optimizing/images",
      fonts: "/app/building-your-application/optimizing/fonts",
      caching: "/app/building-your-application/caching",
      middleware: "/app/building-your-application/routing/middleware",
      "error-handling": "/app/building-your-application/routing/error-handling",
      loading:
        "/app/building-your-application/routing/loading-ui-and-streaming",
      parallel: "/app/building-your-application/routing/parallel-routes",
      intercepting:
        "/app/building-your-application/routing/intercepting-routes",
    },
  },
  nextjs: { base: "https://nextjs.org/docs" },

  vite: {
    base: "https://vite.dev/guide",
    sections: {
      config: "/config",
      plugins: "/api-plugin",
      env: "/env-and-mode",
      build: "/build",
      ssr: "/ssr",
    },
  },

  react: {
    base: "https://react.dev/reference/react",
    sections: {
      hooks: "/hooks",
      components: "/components",
      apis: "/apis",
    },
  },

  // Mobile
  expo: {
    base: "https://docs.expo.dev",
    sections: {
      router: "/router/introduction",
      "file-based": "/router/create-pages",
      navigation: "/router/navigating-pages",
      "push-notifications": "/push-notifications/overview",
      eas: "/eas",
      build: "/build/introduction",
      updates: "/eas-update/introduction",
    },
  },

  "react-native": {
    base: "https://reactnative.dev/docs",
    sections: {
      components: "/components-and-apis",
      navigation: "/navigation",
      performance: "/performance",
    },
  },

  nativewind: {
    base: "https://www.nativewind.dev/v4/overview",
  },

  // UI Libraries
  shadcn: {
    base: "https://ui.shadcn.com/docs",
    sections: {
      installation: "/installation",
      components: "/components",
      theming: "/theming",
      "dark-mode": "/dark-mode",
      cli: "/cli",
      changelog: "/changelog",
      // Individual components
      accordion: "/components/accordion",
      alert: "/components/alert",
      "alert-dialog": "/components/alert-dialog",
      avatar: "/components/avatar",
      badge: "/components/badge",
      button: "/components/button",
      calendar: "/components/calendar",
      card: "/components/card",
      carousel: "/components/carousel",
      checkbox: "/components/checkbox",
      command: "/components/command",
      dialog: "/components/dialog",
      drawer: "/components/drawer",
      dropdown: "/components/dropdown-menu",
      form: "/components/form",
      input: "/components/input",
      label: "/components/label",
      menubar: "/components/menubar",
      "navigation-menu": "/components/navigation-menu",
      popover: "/components/popover",
      progress: "/components/progress",
      "scroll-area": "/components/scroll-area",
      select: "/components/select",
      separator: "/components/separator",
      sheet: "/components/sheet",
      skeleton: "/components/skeleton",
      slider: "/components/slider",
      switch: "/components/switch",
      table: "/components/table",
      tabs: "/components/tabs",
      textarea: "/components/textarea",
      toast: "/components/toast",
      toggle: "/components/toggle",
      tooltip: "/components/tooltip",
    },
  },

  tailwind: {
    base: "https://tailwindcss.com/docs",
    sections: {
      installation: "/installation",
      configuration: "/configuration",
      colors: "/customizing-colors",
      spacing: "/customizing-spacing",
      responsive: "/responsive-design",
      "dark-mode": "/dark-mode",
      flex: "/flex",
      grid: "/grid-template-columns",
      animation: "/animation",
    },
  },

  // Backend Services
  convex: {
    base: "https://docs.convex.dev",
    sections: {
      "getting-started": "/quickstart",
      functions: "/functions",
      queries: "/functions/query-functions",
      mutations: "/functions/mutation-functions",
      actions: "/functions/actions",
      schema: "/database/schemas",
      indexes: "/database/indexes",
      auth: "/auth",
      "file-storage": "/file-storage",
      "http-actions": "/functions/http-actions",
      scheduling: "/scheduling/scheduled-functions",
      "vector-search": "/vector-search",
    },
  },

  supabase: {
    base: "https://supabase.com/docs",
    sections: {
      "getting-started": "/guides/getting-started",
      auth: "/guides/auth",
      database: "/guides/database/overview",
      storage: "/guides/storage",
      functions: "/guides/functions",
      realtime: "/guides/realtime",
      "edge-functions": "/guides/functions/edge-functions",
      rls: "/guides/auth/row-level-security",
      "api-reference": "/reference/javascript/introduction",
    },
  },

  // Monorepo & Build Tools
  turbo: {
    base: "https://turbo.build/repo/docs",
    sections: {
      "getting-started": "/getting-started/create-new",
      configuration: "/reference/configuration",
      "core-concepts": "/core-concepts",
      caching: "/core-concepts/caching",
      "remote-caching": "/core-concepts/remote-caching",
      pipelines: "/core-concepts/monorepos/running-tasks",
      filtering: "/core-concepts/monorepos/filtering",
    },
  },
  turborepo: { base: "https://turbo.build/repo/docs" },

  // Deployment
  vercel: {
    base: "https://vercel.com/docs",
    sections: {
      cli: "/cli",
      deployments: "/deployments/overview",
      "environment-variables": "/projects/environment-variables",
      domains: "/projects/domains",
      functions: "/functions",
      edge: "/functions/edge-functions",
      analytics: "/analytics",
      "speed-insights": "/speed-insights",
    },
  },

  // Package Managers
  pnpm: {
    base: "https://pnpm.io",
    sections: {
      install: "/installation",
      workspaces: "/workspaces",
      cli: "/cli/add",
    },
  },

  bun: {
    base: "https://bun.sh/docs",
    sections: {
      install: "/installation",
      runtime: "/runtime",
      bundler: "/bundler",
      "test-runner": "/cli/test",
    },
  },

  // Testing
  vitest: {
    base: "https://vitest.dev/guide",
    sections: {
      config: "/config",
      api: "/api",
      mocking: "/mocking",
    },
  },

  playwright: {
    base: "https://playwright.dev/docs",
    sections: {
      "getting-started": "/intro",
      selectors: "/selectors",
      assertions: "/assertions",
    },
  },

  // TypeScript
  typescript: {
    base: "https://www.typescriptlang.org/docs/handbook",
    sections: {
      basics: "/2/basic-types",
      types: "/2/everyday-types",
      generics: "/2/generics",
      utility: "/utility-types",
    },
  },
  ts: { base: "https://www.typescriptlang.org/docs/handbook" },

  // Validation
  zod: {
    base: "https://zod.dev",
  },

  // State Management
  tanstack: {
    base: "https://tanstack.com/query/latest/docs/react/overview",
    sections: {
      query: "/query/latest/docs/react/overview",
      table: "/table/latest/docs/introduction",
      router: "/router/latest/docs/overview",
      form: "/form/latest/docs/overview",
    },
  },
  "react-query": {
    base: "https://tanstack.com/query/latest/docs/react/overview",
  },

  zustand: {
    base: "https://docs.pmnd.rs/zustand/getting-started/introduction",
  },
};

/**
 * Resolve a documentation URL from a topic string
 * Format: "topic" or "topic/section"
 */
export function resolveDocUrl(topic: string): string | null {
  const parts = topic.toLowerCase().split("/");
  const mainTopic = parts[0];
  const section = parts.slice(1).join("/");

  const entry = docsRegistry[mainTopic];
  if (!entry) {
    return null;
  }

  if (section && entry.sections?.[section]) {
    return entry.base + entry.sections[section];
  }

  return entry.base;
}

/**
 * Get all available topics
 */
export function getAvailableTopics(): string[] {
  return Object.keys(docsRegistry);
}

/**
 * Get sections for a specific topic
 */
export function getTopicSections(topic: string): string[] {
  const entry = docsRegistry[topic.toLowerCase()];
  if (!entry?.sections) {
    return [];
  }
  return Object.keys(entry.sections);
}

/**
 * Fuzzy search across all topics and sections
 */
export function searchDocs(
  query: string,
): Array<{ topic: string; section?: string; url: string }> {
  const results: Array<{ topic: string; section?: string; url: string }> = [];
  const lowerQuery = query.toLowerCase();

  for (const [topic, entry] of Object.entries(docsRegistry)) {
    // Match topic name
    if (topic.includes(lowerQuery)) {
      results.push({ topic, url: entry.base });
    }

    // Match sections
    if (entry.sections) {
      for (const [section, path] of Object.entries(entry.sections)) {
        if (section.includes(lowerQuery)) {
          results.push({ topic, section, url: entry.base + path });
        }
      }
    }
  }

  return results;
}
