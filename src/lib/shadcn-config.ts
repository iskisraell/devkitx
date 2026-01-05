/**
 * shadcn/ui Configuration
 * Defines theme tokens, fonts, and preset URL builder
 */

// ============================================================================
// DESIGN TOKENS
// ============================================================================

/**
 * Accent theme colors available in shadcn/ui
 */
export const ACCENT_THEMES = [
  "zinc",
  "amber",
  "blue",
  "cyan",
  "emerald",
  "fuchsia",
  "green",
  "indigo",
  "lime",
  "orange",
  "pink",
  "purple",
  "red",
  "rose",
  "sky",
  "teal",
  "violet",
  "yellow",
] as const;

export type AccentTheme = (typeof ACCENT_THEMES)[number];

/**
 * Font options available in shadcn/ui
 */
export const FONTS = [
  "inter",
  "outfit",
  "dm-sans",
  "roboto",
  "raleway",
  "noto-sans",
  "nunito-sans",
  "figtree",
  "public-sans",
  "jetbrains-mono",
] as const;

export type Font = (typeof FONTS)[number];

/**
 * Font display names for UI
 */
export const FONT_LABELS: Record<Font, string> = {
  inter: "Inter",
  outfit: "Outfit",
  "dm-sans": "DM Sans",
  roboto: "Roboto",
  raleway: "Raleway",
  "noto-sans": "Noto Sans",
  "nunito-sans": "Nunito Sans",
  figtree: "Figtree",
  "public-sans": "Public Sans",
  "jetbrains-mono": "JetBrains Mono",
};

/**
 * Theme color display with emoji indicators
 */
export const THEME_DISPLAY: Record<
  AccentTheme,
  { emoji: string; label: string }
> = {
  zinc: { emoji: "⚫", label: "Zinc (Neutral)" },
  amber: { emoji: "🟠", label: "Amber" },
  blue: { emoji: "🔵", label: "Blue" },
  cyan: { emoji: "🩵", label: "Cyan" },
  emerald: { emoji: "🟢", label: "Emerald" },
  fuchsia: { emoji: "🩷", label: "Fuchsia" },
  green: { emoji: "🟩", label: "Green" },
  indigo: { emoji: "🟣", label: "Indigo" },
  lime: { emoji: "🍋", label: "Lime" },
  orange: { emoji: "🟧", label: "Orange" },
  pink: { emoji: "💗", label: "Pink" },
  purple: { emoji: "💜", label: "Purple" },
  red: { emoji: "🔴", label: "Red" },
  rose: { emoji: "🌹", label: "Rose" },
  sky: { emoji: "🩵", label: "Sky" },
  teal: { emoji: "🩵", label: "Teal" },
  violet: { emoji: "💜", label: "Violet" },
  yellow: { emoji: "🟡", label: "Yellow" },
};

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * DevKitX default theme configuration
 */
export const DEFAULTS = {
  baseColor: "zinc" as const, // Locked - never changes
  theme: "zinc" as AccentTheme,
  font: "inter" as Font,
  iconLibrary: "lucide" as const,
  menuAccent: "subtle" as const,
  menuColor: "default" as const,
  radius: "default" as const,
  style: "maia" as const,
  base: "base" as const,
} as const;

// ============================================================================
// URL BUILDER
// ============================================================================

export interface ShadcnPresetOptions {
  theme?: AccentTheme;
  font?: Font;
  template: "next" | "vite";
}

/**
 * Build the shadcn preset URL with custom theme and font
 */
export function buildPresetUrl(options: ShadcnPresetOptions): string {
  const theme = options.theme ?? DEFAULTS.theme;
  const font = options.font ?? DEFAULTS.font;
  const template = options.template;

  const params = new URLSearchParams({
    base: DEFAULTS.base,
    style: DEFAULTS.style,
    baseColor: DEFAULTS.baseColor,
    theme: theme,
    iconLibrary: DEFAULTS.iconLibrary,
    font: font,
    menuAccent: DEFAULTS.menuAccent,
    menuColor: DEFAULTS.menuColor,
    radius: DEFAULTS.radius,
    template: template,
  });

  return `https://ui.shadcn.com/init?${params.toString()}`;
}

// ============================================================================
// COMMAND BUILDERS
// ============================================================================

export type PackageManager = "pnpm" | "bun" | "npm";

export interface ShadcnCreateOptions {
  packageManager: PackageManager;
  template: "next" | "vite";
  theme?: AccentTheme;
  font?: Font;
  projectName: string;
}

/**
 * Build the shadcn create command based on package manager
 */
export function buildShadcnCreateCommand(
  options: ShadcnCreateOptions,
): string[] {
  const presetUrl = buildPresetUrl({
    theme: options.theme,
    font: options.font,
    template: options.template,
  });

  switch (options.packageManager) {
    case "pnpm":
      return [
        "pnpm",
        "dlx",
        "shadcn@latest",
        "create",
        options.projectName,
        "--preset",
        presetUrl,
        "--template",
        options.template,
        "-y",
      ];

    case "bun":
      return [
        "bunx",
        "--bun",
        "shadcn@latest",
        "create",
        options.projectName,
        "--preset",
        presetUrl,
        "--template",
        options.template,
        "-y",
      ];

    case "npm":
    default:
      return [
        "npx",
        "shadcn@latest",
        "create",
        options.projectName,
        "--preset",
        presetUrl,
        "--template",
        options.template,
        "-y",
      ];
  }
}

/**
 * Build the shadcn add command for installing components
 */
export function buildShadcnAddCommand(
  packageManager: PackageManager,
  components: string[],
): string[] {
  const baseCmd =
    packageManager === "pnpm"
      ? ["pnpm", "dlx", "shadcn@latest"]
      : packageManager === "bun"
        ? ["bunx", "--bun", "shadcn@latest"]
        : ["npx", "shadcn@latest"];

  return [...baseCmd, "add", ...components, "-y"];
}

// ============================================================================
// PACKAGE MANAGER RECOMMENDATIONS
// ============================================================================

export interface PackageManagerRecommendation {
  manager: PackageManager;
  label: string;
  recommended: boolean;
  hint: string;
}

/**
 * Get package manager recommendations based on template
 */
export function getPackageManagerRecommendations(
  template: "turbo-monorepo" | "next-only" | "vite-only",
): PackageManagerRecommendation[] {
  switch (template) {
    case "turbo-monorepo":
      return [
        {
          manager: "pnpm",
          label: "pnpm",
          recommended: true,
          hint: "Recommended for monorepos - fast, disk efficient",
        },
        {
          manager: "bun",
          label: "Bun",
          recommended: false,
          hint: "Fast but less mature for complex monorepos",
        },
        {
          manager: "npm",
          label: "npm",
          recommended: false,
          hint: "Maximum compatibility, slower",
        },
      ];

    case "next-only":
      return [
        {
          manager: "pnpm",
          label: "pnpm",
          recommended: true,
          hint: "Recommended by Vercel - fast, reliable",
        },
        {
          manager: "bun",
          label: "Bun",
          recommended: false,
          hint: "Very fast, good Next.js support",
        },
        {
          manager: "npm",
          label: "npm",
          recommended: false,
          hint: "Maximum compatibility",
        },
      ];

    case "vite-only":
      return [
        {
          manager: "bun",
          label: "Bun",
          recommended: true,
          hint: "Recommended - fastest DX with Vite",
        },
        {
          manager: "pnpm",
          label: "pnpm",
          recommended: false,
          hint: "Fast and reliable",
        },
        {
          manager: "npm",
          label: "npm",
          recommended: false,
          hint: "Maximum compatibility",
        },
      ];
  }
}

// ============================================================================
// STATE MANAGER RECOMMENDATIONS
// ============================================================================

export type StateManager = "zustand" | "jotai" | "none";

export interface StateManagerRecommendation {
  manager: StateManager;
  label: string;
  recommended: boolean;
  hint: string;
}

/**
 * Get state manager recommendations based on template and backend
 */
export function getStateManagerRecommendations(
  template: "turbo-monorepo" | "next-only" | "vite-only",
  backend: string,
): StateManagerRecommendation[] {
  const hasConvex = backend === "convex" || backend === "both";

  // If using Convex, it handles most state - lighter recommendation
  if (hasConvex) {
    return [
      {
        manager: "zustand",
        label: "Zustand",
        recommended: true,
        hint: "Recommended for UI state alongside Convex",
      },
      {
        manager: "jotai",
        label: "Jotai",
        recommended: false,
        hint: "Good for granular UI state",
      },
      {
        manager: "none",
        label: "None",
        recommended: false,
        hint: "Convex handles most state - add later if needed",
      },
    ];
  }

  // For Next.js App Router, Jotai has better SSR support
  if (template === "next-only") {
    return [
      {
        manager: "jotai",
        label: "Jotai",
        recommended: true,
        hint: "Recommended for Next.js App Router - great SSR support",
      },
      {
        manager: "zustand",
        label: "Zustand",
        recommended: false,
        hint: "Great DevTools, simpler API",
      },
      {
        manager: "none",
        label: "None",
        recommended: false,
        hint: "Add state management later",
      },
    ];
  }

  // For Vite SPA, either works well
  return [
    {
      manager: "zustand",
      label: "Zustand",
      recommended: true,
      hint: "Recommended - simple, powerful, great DevTools",
    },
    {
      manager: "jotai",
      label: "Jotai",
      recommended: false,
      hint: "Better for granular/atomic state updates",
    },
    {
      manager: "none",
      label: "None",
      recommended: false,
      hint: "Add state management later",
    },
  ];
}

// ============================================================================
// CORE DEPENDENCIES
// ============================================================================

/**
 * Core utilities to install in every project
 */
export const CORE_DEPENDENCIES = [
  "clsx",
  "tailwind-merge",
  "lucide-react",
  "framer-motion",
] as const;

/**
 * State manager dependencies
 */
export const STATE_MANAGER_DEPS: Record<StateManager, string[]> = {
  zustand: ["zustand"],
  jotai: ["jotai"],
  none: [],
};

/**
 * Base shadcn components to pre-install
 */
export const BASE_SHADCN_COMPONENTS = [
  "button",
  "card",
  "input",
  "label",
  "dialog",
  "dropdown-menu",
  "sheet",
  "sonner",
  "skeleton",
  "avatar",
  "badge",
  "separator",
] as const;
