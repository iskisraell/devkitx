/**
 * ralph command - Ralphy orchestration companion for AI-assisted development
 *
 * Strategy:
 * - Ralphy.sh = The orchestrator (runs loops, parallel agents, git worktrees)
 * - OpenCode = The AI engine that Ralphy calls via --opencode flag
 * - dx ralph = Setup companion (init projects, create PRDs, launch ralphy)
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { join, basename } from "path";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { spawn } from "child_process";

// ============================================================================
// COMPREHENSIVE DOCUMENTATION
// ============================================================================

const RALPHY_FULL_DOCS = `# Ralphy Complete Reference Guide

> **Version:** 3.1.0 | **Engine:** OpenCode | **Platform:** Windows (Git Bash)

---

## TL;DR - Quick Start in 60 Seconds

\`\`\`bash
# One-time setup
dx ralph install              # Install ralphy.sh
dx ralph init                 # Initialize project

# Create and run
dx ralph new my-feature       # Create PRD
# Edit docs/prd/my-feature.prd.md with your requirements
dx ralph run --prd docs/prd/my-feature.prd.md
\`\`\`

---

## Hot Sessions - Copy-Paste Commands

### Sequential (Single Agent)
\`\`\`bash
dx ralph run                                    # Default PRD.md
dx ralph run --prd docs/prd/auth.prd.md         # Specific PRD
dx ralph run --fast                             # Skip tests/lint
dx ralph run --max-iterations 10                # Limit iterations
\`\`\`

### Parallel (Multiple Agents)
\`\`\`bash
dx ralph run --parallel                         # 3 agents (default)
dx ralph run --parallel --max-parallel 5        # 5 agents
dx ralph run --yaml tasks.yaml --parallel       # YAML with groups
\`\`\`

### Git Workflow
\`\`\`bash
dx ralph run --branch-per-task                  # Feature branches
dx ralph run --branch-per-task --create-pr      # Auto PRs
dx ralph run --parallel --create-pr --draft-pr  # Draft PRs
\`\`\`

### Direct Shell Access
\`\`\`bash
# Add to PATH first: export PATH="$HOME/.ralphy:$PATH"
ralphy --opencode --prd PRD.md
ralphy --opencode --parallel --max-parallel 4 --create-pr
\`\`\`

---

## Architecture Overview

\`\`\`
┌─────────────────────────────────────────────────────────────────────┐
│                           YOU (Human)                               │
│  "I want to add user authentication"                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         dx ralph                                    │
│  - Companion CLI for setup and launching                            │
│  - Creates PRDs, initializes projects                               │
│  - Wraps ralphy.sh for Windows                                      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ralphy.sh                                    │
│  THE ORCHESTRATOR                                                   │
│  - Parses PRD/YAML/GitHub Issues for tasks                          │
│  - Creates git worktrees for parallel isolation                     │
│  - Spawns AI agents (OpenCode) for each task                        │
│  - Monitors progress, retries failures                              │
│  - Manages branches, creates PRs                                    │
│  - Tracks costs and token usage                                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
    ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
    │   OpenCode    │  │   OpenCode    │  │   OpenCode    │
    │   Agent 1     │  │   Agent 2     │  │   Agent 3     │
    │  (worktree1)  │  │  (worktree2)  │  │  (worktree3)  │
    │               │  │               │  │               │
    │  Task: Auth   │  │  Task: API    │  │  Task: Tests  │
    └───────────────┘  └───────────────┘  └───────────────┘
            │                  │                  │
            ▼                  ▼                  ▼
    ┌─────────────────────────────────────────────────────┐
    │              Git Repository                         │
    │  - Branch: ralphy/agent-1-auth                      │
    │  - Branch: ralphy/agent-2-api                       │
    │  - Branch: ralphy/agent-3-tests                     │
    │  → Merged to base or PRs created                    │
    └─────────────────────────────────────────────────────┘
\`\`\`

---

## File Architecture

### Project Files (Created by \`dx ralph init\`)

\`\`\`
your-project/
├── AGENTS.md              # AI agent instructions (read first)
├── PRD.md                 # Default PRD file
├── progress.txt           # Progress log (required by ralphy.sh)
├── .ralph/
│   └── signs.md           # Project rules for Ralph
└── docs/
    └── prd/               # Additional PRD files
        ├── feature-1.prd.md
        ├── feature-2.prd.md
        └── tasks.yaml     # YAML task file (optional)
\`\`\`

### System Files (Created by \`dx ralph install\`)

\`\`\`
~/.ralphy/
├── ralphy.sh              # Main orchestration script
├── ralphy.ps1             # PowerShell wrapper for Windows
└── ralphy.cmd             # Batch wrapper for PATH
\`\`\`

---

## File Descriptions

### AGENTS.md
**Purpose:** Primary instruction file for AI agents. Read at the start of every session.

**Contains:**
- Project overview and stack information
- Ralphy configuration and quick start
- Ralph's Commandments
- Project structure
- Development guidelines
- Verification commands

**When to update:** When project structure changes, new patterns are established, or guidelines evolve.

---

### PRD.md (Product Requirement Document)
**Purpose:** Defines a specific task or feature for the AI to implement.

**Required Sections:**
| Section | Purpose |
|---------|---------|
| TL;DR | One sentence summary |
| Goal | Measurable success criteria |
| Constraints | What NOT to do |
| Acceptance Criteria | Checkbox list of requirements |
| Verification | Commands to prove it works |
| Notes | Context for the AI |
| Progress | Updated after each iteration |

---

### .ralph/signs.md
**Purpose:** Persistent rules that Ralph must follow across ALL iterations.

**Contains:**
- Delete protection rules
- Testing requirements
- Type checking requirements
- Communication protocols
- Code quality standards
- Git practices
- Completion signal rules

**When to update:** When you discover behaviors you want to enforce or prevent.

---

### progress.txt
**Purpose:** Running log of what Ralphy has done. Required by ralphy.sh.

**Format:** Free-form text log with timestamps.

---

## PRD Format Specification

### Correct PRD Structure

\`\`\`markdown
# PRD: Feature Name

## TL;DR

- One sentence: what are we shipping?

## Goal

- What outcome should exist when done?
- Be specific and measurable
- Each goal should be verifiable

## Constraints

- What should NOT be changed
- Technology limitations
- Time/scope boundaries

## Acceptance Criteria

- [ ] First observable success condition
- [ ] Second success condition
- [ ] Edge case: handling empty states
- [ ] Edge case: error handling
- [ ] Tests must pass

## Verification

\\\`\\\`\\\`bash
pnpm typecheck
pnpm test
pnpm build
\\\`\\\`\\\`

## Notes

- Important context
- Architectural decisions
- Related files

## Progress

### Iteration 1 - 2026-01-17

- **Summary:** What was done
- **Status:** In Progress
- **Next Steps:** What comes next
\`\`\`

### YAML Task Format (for Parallel Execution)

\`\`\`yaml
tasks:
  # Group 1: Foundation (runs first in parallel)
  - title: "Create user model with fields: id, email, password, createdAt"
    completed: false
    parallel_group: 1

  - title: "Create post model with fields: id, title, content, authorId"
    completed: false
    parallel_group: 1

  # Group 2: Runs after group 1 completes
  - title: "Add user-post relationship and foreign keys"
    completed: false
    parallel_group: 2

  - title: "Create API endpoints for CRUD operations"
    completed: false
    parallel_group: 2

  # Group 3: Final integration
  - title: "Write integration tests for all endpoints"
    completed: false
    parallel_group: 3
\`\`\`

---

## Command Reference

### dx ralph init
Initializes a project for Ralphy.

\`\`\`bash
dx ralph init                 # Current directory
dx ralph init -p /path/to    # Specific path
dx ralph init --force         # Overwrite existing files
\`\`\`

**Creates:**
- AGENTS.md
- PRD.md
- progress.txt
- .ralph/signs.md
- docs/prd/ directory

---

### dx ralph install
Installs or updates ralphy.sh.

\`\`\`bash
dx ralph install
\`\`\`

**Downloads:** Latest ralphy.sh from GitHub
**Creates:** PowerShell and batch wrappers

---

### dx ralph new
Creates a new PRD from template.

\`\`\`bash
dx ralph new my-feature           # Markdown PRD
dx ralph new my-feature -i        # Interactive mode
dx ralph new my-tasks -y          # YAML task file
\`\`\`

---

### dx ralph run
Runs Ralphy with OpenCode.

\`\`\`bash
dx ralph run [options]
\`\`\`

**Options:**
| Flag | Description | Default |
|------|-------------|---------|
| --prd <file> | PRD file path | PRD.md |
| --yaml <file> | YAML task file | - |
| --parallel | Enable parallel execution | false |
| --max-parallel <n> | Max concurrent agents | 3 |
| --fast | Skip tests and linting | false |
| --branch-per-task | Create feature branch per task | false |
| --create-pr | Auto-create pull requests | false |
| --draft-pr | Create PRs as drafts | false |
| --max-iterations <n> | Limit iterations (0=unlimited) | 0 |
| --dry-run | Preview without executing | false |
| -v, --verbose | Debug output | false |

---

### dx ralph status
Checks Ralphy setup status.

\`\`\`bash
dx ralph status
dx ralph status -p /path/to/project
\`\`\`

---

### dx ralph help
Shows this comprehensive documentation.

\`\`\`bash
dx ralph help                     # Display in terminal
dx ralph help --export            # Export as markdown file
dx ralph help --export my-docs.md # Export to specific file
\`\`\`

---

## The Ralph Loop - How It Works

### Sequential Execution Flow

\`\`\`
┌──────────────────────────────────────────────────────────────┐
│  START: dx ralph run --prd PRD.md                            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  1. PARSE: Read PRD.md, find tasks marked as [ ]             │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  2. PROMPT: Build prompt with task + context                 │
│     - Include @PRD.md @progress.txt                          │
│     - Add instructions for implementation                    │
│     - Add verification commands                              │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  3. EXECUTE: Run OpenCode with prompt                        │
│     - OpenCode reads AGENTS.md, .ralph/signs.md              │
│     - Implements the task                                    │
│     - Runs tests/lint (unless --fast)                        │
│     - Commits changes                                        │
│     - Updates PRD.md (marks task [x])                        │
│     - Appends to progress.txt                                │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  4. CHECK: Did OpenCode output <promise>COMPLETE</promise>?  │
│                                                              │
│     YES ──────────────────────┐                              │
│                               │                              │
│     NO ───┐                   │                              │
│           │                   │                              │
│           ▼                   ▼                              │
│     ┌─────────────┐    ┌─────────────┐                       │
│     │ More tasks? │    │    DONE!    │                       │
│     │ YES → Loop  │    │  All tasks  │                       │
│     │ NO → Done   │    │  complete   │                       │
│     └─────────────┘    └─────────────┘                       │
└──────────────────────────────────────────────────────────────┘
\`\`\`

### Parallel Execution Flow

\`\`\`
┌──────────────────────────────────────────────────────────────┐
│  START: dx ralph run --parallel --max-parallel 3             │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  1. PARSE: Get all tasks, group by parallel_group            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  2. FOR EACH GROUP (sequential):                             │
│                                                              │
│     ┌────────────────────────────────────────────────────┐   │
│     │  2a. CREATE WORKTREES                              │   │
│     │      - /tmp/xxx/agent-1 → branch: ralphy/agent-1   │   │
│     │      - /tmp/xxx/agent-2 → branch: ralphy/agent-2   │   │
│     │      - /tmp/xxx/agent-3 → branch: ralphy/agent-3   │   │
│     └────────────────────────────────────────────────────┘   │
│                                                              │
│     ┌────────────────────────────────────────────────────┐   │
│     │  2b. SPAWN AGENTS (parallel)                       │   │
│     │      Agent 1 ─────► OpenCode ─────► Task 1         │   │
│     │      Agent 2 ─────► OpenCode ─────► Task 2         │   │
│     │      Agent 3 ─────► OpenCode ─────► Task 3         │   │
│     └────────────────────────────────────────────────────┘   │
│                                                              │
│     ┌────────────────────────────────────────────────────┐   │
│     │  2c. WAIT FOR ALL AGENTS                           │   │
│     │      - Monitor progress                            │   │
│     │      - Retry on failure (--max-retries)            │   │
│     └────────────────────────────────────────────────────┘   │
│                                                              │
│     ┌────────────────────────────────────────────────────┐   │
│     │  2d. MERGE OR PR                                   │   │
│     │      --create-pr: Create PRs for each branch       │   │
│     │      Otherwise: Merge branches to base             │   │
│     └────────────────────────────────────────────────────┘   │
│                                                              │
│     ┌────────────────────────────────────────────────────┐   │
│     │  2e. CLEANUP WORKTREES                             │   │
│     └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  3. NEXT GROUP (if more groups exist)                        │
└──────────────────────────────────────────────────────────────┘
\`\`\`

---

## Ralph's Commandments

### 1. THOU SHALT NOT STOP
Complete the task before stopping. Don't give up at the first error.

### 2. THOU SHALT LOOK FOR SIGNS
Always read \`.ralph/signs.md\` for project-specific rules.

### 3. THOU SHALT BE DETERMINISTIC
Be reliably persistent. Same input → same approach.

### 4. THOU SHALT TUNE NOT BLAME
When failing, improve the prompts and PRDs, not blame the tools.

### 5. THOU SHALT ITERATE
Every failure is a learning opportunity. Update Progress section.

---

## Completion Protocol

The AI signals completion by outputting:
\`\`\`
<promise>COMPLETE</promise>
\`\`\`

**Only output this when:**
1. All acceptance criteria are met (all checkboxes checked)
2. Tests pass
3. Type check passes
4. Build succeeds (if applicable)

Ralphy also verifies by checking the actual PRD state - if tasks remain unchecked, the loop continues regardless of the completion signal.

---

## AI Agent Prompt for Converting PRDs

Use this prompt to have an AI agent convert existing documents to proper Ralphy PRD format:

---

### PROMPT: Convert Documents to Ralphy PRD Format

\`\`\`
You are a PRD formatting assistant. Convert the following document(s) into properly formatted Ralphy PRD files.

## Rules:

1. **File Naming:** Use kebab-case: \`feature-name.prd.md\`

2. **Required Sections:** Every PRD MUST have:
   - # PRD: <Title>
   - ## TL;DR (one sentence)
   - ## Goal (measurable outcomes)
   - ## Constraints (what NOT to do)
   - ## Acceptance Criteria (checkbox list)
   - ## Verification (bash commands)
   - ## Notes (context)
   - ## Progress (empty, will be filled by AI)

3. **Acceptance Criteria Rules:**
   - Use \`- [ ]\` format (unchecked checkboxes)
   - Each criterion must be binary (done or not done)
   - Include edge cases as separate items
   - Include "Tests must pass" as final item

4. **Verification Commands:**
   - Include actual commands to run
   - Use the project's package manager (pnpm/npm/bun)
   - Always include: typecheck, test, build

5. **For Multiple Tasks/Features:**
   - Create separate PRD files for each feature
   - OR create a YAML task file for parallel execution
   - Group related tasks that can run in parallel

## Input Document(s):

<paste your documents here>

## Output:

Generate properly formatted PRD file(s) following the template below:

---

# PRD: <Feature Name>

## TL;DR

- <One sentence describing what we're shipping>

## Goal

- <Specific, measurable outcome 1>
- <Specific, measurable outcome 2>

## Constraints

- <What should NOT be changed>
- <Technology limitations>
- <Scope boundaries>

## Acceptance Criteria

- [ ] <Observable success condition 1>
- [ ] <Observable success condition 2>
- [ ] Edge case: <specific scenario>
- [ ] Error handling: <specific error case>
- [ ] Tests must pass

## Verification

\\\`\\\`\\\`bash
pnpm typecheck
pnpm test
pnpm build
\\\`\\\`\\\`

## Notes

- <Important context>
- <Related files: src/path/to/file.ts>
- <Architectural decisions>

## Progress

<!-- AI will update this section after each iteration -->

---
\`\`\`

---

### PROMPT: Convert to YAML Task File

\`\`\`
Convert the following tasks into a Ralphy YAML task file for parallel execution.

## Rules:

1. Group independent tasks with the same parallel_group number
2. Tasks that depend on others should have a higher parallel_group number
3. Use descriptive, actionable titles
4. Set completed: false for all new tasks

## Input:

<paste your task list here>

## Output Format:

tasks:
  - title: "Specific, actionable task description"
    completed: false
    parallel_group: 1

  - title: "Another independent task"
    completed: false
    parallel_group: 1

  - title: "Task that depends on group 1"
    completed: false
    parallel_group: 2
\`\`\`

---

## Batch PRD Conversion

When you have multiple unformatted PRDs or requirements documents:

\`\`\`bash
# 1. Place all documents in a folder
mkdir -p docs/raw-requirements

# 2. Use this prompt with an AI agent:
\`\`\`

\`\`\`
I have multiple requirement documents that need to be converted to Ralphy PRD format.

For each document:
1. Create a properly formatted PRD file
2. Name it: docs/prd/<feature-name>.prd.md
3. Extract clear acceptance criteria
4. Add appropriate verification commands

Documents to convert:
<paste all documents or file paths>

After conversion, also create a master YAML file (docs/prd/all-tasks.yaml) 
that lists all tasks across all PRDs, grouped by dependency.
\`\`\`

---

## Troubleshooting

### "Git Bash not found"
Install Git for Windows: https://git-scm.com/download/win

### "ralphy.sh not installed"
Run: \`dx ralph install\`

### "PRD.md not found"
Run: \`dx ralph init\` in your project directory

### "Tasks not being marked complete"
- Ensure PRD uses \`- [ ]\` format (with space inside brackets)
- Check that task text matches exactly what's in the PRD

### "Parallel agents failing"
- Reduce \`--max-parallel\` to 2 or 3
- Check disk space (worktrees use space)
- Check API rate limits

### "Merge conflicts in parallel mode"
- Ralphy attempts AI-powered merge conflict resolution
- If it fails, manually resolve and continue
- Consider using \`--create-pr\` to review changes before merging

---

## Cost Tracking

Ralphy tracks costs per AI engine:

| Engine | Metrics |
|--------|---------|
| OpenCode | Input/output tokens, actual cost |
| Claude Code | Input/output tokens, estimated cost |
| Codex | Input/output tokens (if provided) |
| Cursor | Total API duration (no tokens) |

View costs in the summary after Ralphy completes.

---

## Best Practices

### 1. Start Small
Begin with 3 parallel agents and increase gradually.

### 2. Use Phases
Break large features into multiple PRDs:
\`\`\`bash
dx ralph run --prd docs/prd/auth-phase1.prd.md
dx ralph run --prd docs/prd/auth-phase2.prd.md
\`\`\`

### 3. Include Verification
Always add typecheck, test, and build commands.

### 4. Be Specific
"Add user authentication" is bad.
"Add email/password login with JWT tokens stored in httpOnly cookies" is good.

### 5. Update signs.md
When you discover patterns to enforce or prevent, add them to \`.ralph/signs.md\`.

### 6. Review Progress
Check the Progress section in PRDs to understand what the AI has tried.

---

## Links

- **Ralphy GitHub:** https://github.com/michaelshimeles/ralphy
- **Ralph Loop Concept:** https://ghuntley.com/ralph/
- **OpenCode:** https://opencode.ai/docs/
- **DevKitX:** https://github.com/iskisraell/devkitx

---

*Generated by dx ralph help | Ralphy v3.1.0*
`;

// Function to strip ANSI and format for terminal display
function formatForTerminal(markdown: string): string {
  // Convert markdown to terminal-friendly format
  let output = markdown;

  // Convert headers to bold
  output = output.replace(/^# (.+)$/gm, (_, title) =>
    chalk.bold.cyan(`\n${"═".repeat(70)}\n  ${title}\n${"═".repeat(70)}`),
  );
  output = output.replace(/^## (.+)$/gm, (_, title) =>
    chalk.bold.white(`\n── ${title} ──`),
  );
  output = output.replace(/^### (.+)$/gm, (_, title) =>
    chalk.yellow(`\n  ${title}`),
  );

  // Convert code blocks to gray
  output = output.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    const lines = code.trim().split("\n");
    return (
      "\n" +
      lines.map((line: string) => chalk.gray(`    ${line}`)).join("\n") +
      "\n"
    );
  });

  // Convert inline code
  output = output.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

  // Convert bold
  output = output.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));

  // Convert tables (simplified)
  output = output.replace(/\|(.+)\|/g, (match) => chalk.gray(match));

  return output;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RALPHY_DIR = join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".ralphy",
);
const RALPHY_SCRIPT = join(RALPHY_DIR, "ralphy.sh");
const RALPHY_PS1 = join(RALPHY_DIR, "ralphy.ps1");
const RALPHY_CMD = join(RALPHY_DIR, "ralphy.cmd");

// ============================================================================
// TEMPLATES - Updated for Ralphy shell workflow
// ============================================================================

const AGENTS_MD_TEMPLATE = `# AI Agent Instructions

> This file provides context and rules for AI coding agents working on this project.
> Ralphy orchestrates OpenCode to work through tasks autonomously.

## Project Overview

**Project Name:** {{PROJECT_NAME}}
**Created:** {{DATE}}
**Stack:** {{STACK}}

## Ralphy Configuration

This project uses **Ralphy** for autonomous AI coding loops.

### Quick Start

\`\`\`bash
# Initialize project for Ralphy (creates this file, PRD templates, etc.)
dx ralph init

# Create a new PRD for a feature
dx ralph new my-feature

# Run Ralphy with OpenCode (sequential)
dx ralph run

# Run with parallel agents (uses git worktrees)
dx ralph run --parallel --max-parallel 3

# Run specific PRD
dx ralph run --prd docs/prd/my-feature.prd.md

# Feature branch workflow with auto PRs
dx ralph run --branch-per-task --create-pr
\`\`\`

### Direct ralphy.sh Usage

\`\`\`bash
# From any terminal with Git Bash
ralphy --opencode --prd PRD.md

# Parallel with 4 agents
ralphy --opencode --parallel --max-parallel 4

# Fast mode (skip tests/lint)
ralphy --opencode --fast

# Dry run to preview
ralphy --opencode --dry-run
\`\`\`

## Ralph's Commandments

1. **THOU SHALT NOT STOP** - Complete the task before stopping
2. **THOU SHALT LOOK FOR SIGNS** - Read .ralph/signs.md for project rules
3. **THOU SHALT BE DETERMINISTIC** - Be reliably persistent
4. **THOU SHALT TUNE NOT BLAME** - When failing, tune prompts not tools
5. **THOU SHALT ITERATE** - Every failure is an opportunity for tuning

## Project Structure

{{PROJECT_STRUCTURE}}

## Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow existing patterns in the codebase
- Write tests for new functionality
- Keep components small and focused

### Git Workflow
- Ralphy creates feature branches automatically with \`--branch-per-task\`
- Each task gets its own isolated git worktree in parallel mode
- PRs are created automatically with \`--create-pr\`

### Testing
- Run \`{{TEST_COMMAND}}\` before marking tasks complete
- Ensure all tests pass before signaling completion

## Verification Commands

| Task | Command |
|------|---------|
| Type check | \`{{TYPECHECK_COMMAND}}\` |
| Lint | \`{{LINT_COMMAND}}\` |
| Test | \`{{TEST_COMMAND}}\` |
| Build | \`{{BUILD_COMMAND}}\` |

## PRD Files Location

All Product Requirement Documents are in \`docs/prd/\`.

Create PRDs with:
\`\`\`bash
dx ralph new my-feature
\`\`\`

---

*This file is read by AI agents at the start of each session. Keep it updated.*
`;

const PRD_TEMPLATE = `# PRD: {{FEATURE_NAME}}

## TL;DR

- Brief one-sentence description of what we're shipping

## Goal

- What outcome should exist when done?
- Be specific and measurable
- Define success criteria clearly

## Constraints

- Technical constraints
- Deadlines or time limits
- What should NOT be changed
- Dependencies to respect

## Acceptance Criteria

- [ ] First observable success condition
- [ ] Second success condition
- [ ] Edge case: handling empty states
- [ ] Edge case: error handling
- [ ] Tests must pass

## Verification

Run these commands to verify the feature works:

\`\`\`bash
# Type check
{{TYPECHECK_COMMAND}}

# Run tests
{{TEST_COMMAND}}

# Build
{{BUILD_COMMAND}}
\`\`\`

## Notes

- Important context for the loop to remember
- Architectural decisions
- Related files or components

## Progress

Update this section after each iteration:

### {{Title}} - {{Date}}

- **Summary:** What was done
- **Decisions:** Any decisions made
- **Assumptions:** Assumptions that were made
- **Risks:** Potential issues
- **Status:** In Progress / Blocked / Complete
- **Next Steps:**
  - What comes next
  - And why

---

## Add entries below this line:

`;

const SIGNS_MD_TEMPLATE = `# Ralph Signs - Project Rules

> These are persistent rules that Ralph must follow across all iterations.
> Edit this file to tune Ralph's behavior.

## DO NOT DELETE

Before any delete operation:

1. Verify the file is safe to delete
2. Check if the file is tracked by git
3. If uncertain, ask for confirmation
4. NEVER delete test files without explicit instruction

## ALWAYS TEST

After implementing any feature:

1. Run the test suite: \`{{TEST_COMMAND}}\`
2. Ensure no regressions in existing tests
3. Write tests for new functionality
4. Verify tests pass before marking complete

## ALWAYS TYPE CHECK

Before signaling completion:

1. Run: \`{{TYPECHECK_COMMAND}}\`
2. Fix all TypeScript errors
3. No \`any\` types without justification

## COMMUNICATION

If stuck for more than 3 iterations:

1. Summarize what you've tried
2. Identify the specific blocker
3. Document the issue in the PRD Progress section
4. Ask for human guidance

## CODE QUALITY

1. Follow existing code patterns
2. Keep functions small and focused
3. Add comments for complex logic
4. Use meaningful variable names

## GIT PRACTICES

1. Make atomic commits
2. Write descriptive commit messages
3. Don't commit broken code
4. Reference PRD in commit messages when applicable

## COMPLETION SIGNAL

Only output the completion promise when:

1. All acceptance criteria are met
2. Tests pass
3. Type check passes
4. Build succeeds (if applicable)

---

*Add project-specific rules below:*

`;

const YAML_TASKS_TEMPLATE = `# Ralphy YAML Task File
# Use this format for dependency-aware parallel execution

tasks:
  # Group 1: Foundation tasks (run first)
  - title: "{{TASK_1}}"
    completed: false
    parallel_group: 1

  - title: "{{TASK_2}}"
    completed: false
    parallel_group: 1

  # Group 2: Dependent tasks (run after group 1)
  - title: "{{TASK_3}}"
    completed: false
    parallel_group: 2
`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function detectProjectStack(projectPath: string): {
  stack: string;
  testCommand: string;
  buildCommand: string;
  typecheckCommand: string;
  lintCommand: string;
  structure: string;
} {
  const hasPackageJson = existsSync(join(projectPath, "package.json"));
  const hasNextConfig =
    existsSync(join(projectPath, "next.config.js")) ||
    existsSync(join(projectPath, "next.config.ts")) ||
    existsSync(join(projectPath, "next.config.mjs"));
  const hasViteConfig =
    existsSync(join(projectPath, "vite.config.ts")) ||
    existsSync(join(projectPath, "vite.config.js"));
  const hasTurbo = existsSync(join(projectPath, "turbo.json"));
  const hasConvex = existsSync(join(projectPath, "convex"));
  const hasBunLock = existsSync(join(projectPath, "bun.lock"));
  const hasPnpmLock = existsSync(join(projectPath, "pnpm-lock.yaml"));

  const pm = hasBunLock ? "bun" : hasPnpmLock ? "pnpm" : "npm";
  const pmRun = pm === "npm" ? "npm run" : pm;

  let stack = "";
  let structure = "";

  if (hasTurbo) {
    stack = "Turborepo Monorepo";
    structure = `├── apps/
│   └── web/         # Main application
├── packages/        # Shared packages
├── docs/
│   └── prd/         # PRD files
├── .ralph/          # Ralph configuration
└── AGENTS.md`;
  } else if (hasNextConfig) {
    stack = "Next.js";
    structure = `├── src/
│   ├── app/         # App Router
│   ├── components/  # React components
│   └── lib/         # Utilities
├── docs/
│   └── prd/         # PRD files
├── .ralph/          # Ralph configuration
└── AGENTS.md`;
  } else if (hasViteConfig) {
    stack = "Vite + React";
    structure = `├── src/
│   ├── components/  # React components
│   ├── lib/         # Utilities
│   └── main.tsx
├── docs/
│   └── prd/         # PRD files
├── .ralph/          # Ralph configuration
└── AGENTS.md`;
  } else {
    stack = "TypeScript Project";
    structure = `├── src/             # Source code
├── docs/
│   └── prd/         # PRD files
├── .ralph/          # Ralph configuration
└── AGENTS.md`;
  }

  if (hasConvex) {
    stack += " + Convex";
  }

  return {
    stack,
    testCommand: `${pmRun} test`,
    buildCommand: `${pmRun} build`,
    typecheckCommand: `${pmRun} typecheck`,
    lintCommand: `${pmRun} lint`,
    structure,
  };
}

function findGitBash(): string | null {
  const paths = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
    "C:\\Git\\bin\\bash.exe",
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return null;
}

// ============================================================================
// SUBCOMMANDS
// ============================================================================

async function initRalph(projectPath: string, options: { force?: boolean }) {
  const projectName = basename(projectPath);
  const {
    stack,
    testCommand,
    buildCommand,
    typecheckCommand,
    lintCommand,
    structure,
  } = detectProjectStack(projectPath);

  const date = new Date().toISOString().split("T")[0];

  // Create directories
  const dirs = [join(projectPath, "docs", "prd"), join(projectPath, ".ralph")];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Generate AGENTS.md
  const agentsContent = AGENTS_MD_TEMPLATE.replace(
    /\{\{PROJECT_NAME\}\}/g,
    projectName,
  )
    .replace(/\{\{DATE\}\}/g, date)
    .replace(/\{\{STACK\}\}/g, stack)
    .replace(/\{\{PROJECT_STRUCTURE\}\}/g, structure)
    .replace(/\{\{TEST_COMMAND\}\}/g, testCommand)
    .replace(/\{\{BUILD_COMMAND\}\}/g, buildCommand)
    .replace(/\{\{TYPECHECK_COMMAND\}\}/g, typecheckCommand)
    .replace(/\{\{LINT_COMMAND\}\}/g, lintCommand);

  // Generate signs.md
  const signsContent = SIGNS_MD_TEMPLATE.replace(
    /\{\{TEST_COMMAND\}\}/g,
    testCommand,
  ).replace(/\{\{TYPECHECK_COMMAND\}\}/g, typecheckCommand);

  // Write files
  const agentsPath = join(projectPath, "AGENTS.md");
  const signsPath = join(projectPath, ".ralph", "signs.md");
  const prdPath = join(projectPath, "PRD.md");

  if (!existsSync(agentsPath) || options.force) {
    await Bun.write(agentsPath, agentsContent);
    console.log(chalk.green("  ✓ Created AGENTS.md"));
  } else {
    console.log(
      chalk.yellow("  ○ AGENTS.md already exists (use --force to overwrite)"),
    );
  }

  if (!existsSync(signsPath) || options.force) {
    await Bun.write(signsPath, signsContent);
    console.log(chalk.green("  ✓ Created .ralph/signs.md"));
  } else {
    console.log(chalk.yellow("  ○ .ralph/signs.md already exists"));
  }

  // Create default PRD.md if not exists
  if (!existsSync(prdPath)) {
    const defaultPrd = PRD_TEMPLATE.replace(
      /\{\{FEATURE_NAME\}\}/g,
      "Initial Setup",
    )
      .replace(/\{\{TEST_COMMAND\}\}/g, testCommand)
      .replace(/\{\{BUILD_COMMAND\}\}/g, buildCommand)
      .replace(/\{\{TYPECHECK_COMMAND\}\}/g, typecheckCommand);

    await Bun.write(prdPath, defaultPrd);
    console.log(chalk.green("  ✓ Created PRD.md"));
  }

  // Create progress.txt (required by ralphy.sh)
  const progressPath = join(projectPath, "progress.txt");
  if (!existsSync(progressPath)) {
    await Bun.write(
      progressPath,
      `# Ralphy Progress Log\n# Created: ${date}\n\n`,
    );
    console.log(chalk.green("  ✓ Created progress.txt"));
  }

  // Update .gitignore
  const gitignorePath = join(projectPath, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = await Bun.file(gitignorePath).text();
    const additions = [];
    if (!gitignore.includes("progress.txt")) additions.push("progress.txt");
    if (additions.length > 0) {
      await Bun.write(
        gitignorePath,
        gitignore + `\n# Ralphy\n${additions.join("\n")}\n`,
      );
      console.log(chalk.green("  ✓ Updated .gitignore"));
    }
  }
}

async function installRalphy() {
  // Create .ralphy directory
  if (!existsSync(RALPHY_DIR)) {
    mkdirSync(RALPHY_DIR, { recursive: true });
  }

  // Download ralphy.sh
  console.log(chalk.gray("  Downloading ralphy.sh..."));
  const response = await fetch(
    "https://raw.githubusercontent.com/michaelshimeles/ralphy/main/ralphy.sh",
  );
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  const script = await response.text();
  await Bun.write(RALPHY_SCRIPT, script);
  console.log(chalk.green(`  ✓ Installed ${RALPHY_SCRIPT}`));

  // Create PowerShell wrapper (ralphy.ps1) - already exists from earlier
  console.log(chalk.green(`  ✓ PowerShell wrapper at ${RALPHY_PS1}`));

  // Create batch wrapper for PATH
  const cmdContent = `@powershell -ExecutionPolicy Bypass -File "%USERPROFILE%\\.ralphy\\ralphy.ps1" %*`;
  await Bun.write(RALPHY_CMD, cmdContent);
  console.log(chalk.green(`  ✓ Created ${RALPHY_CMD}`));

  return { ralphyDir: RALPHY_DIR };
}

async function createNewPrd(
  projectPath: string,
  featureName: string,
  options: { interactive?: boolean; yaml?: boolean },
) {
  const prdDir = join(projectPath, "docs", "prd");

  if (!existsSync(prdDir)) {
    mkdirSync(prdDir, { recursive: true });
  }

  const { testCommand, buildCommand, typecheckCommand } =
    detectProjectStack(projectPath);

  // Sanitize feature name for filename
  const filename = featureName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const ext = options.yaml ? ".yaml" : ".prd.md";
  const filePath = join(prdDir, `${filename}${ext}`);

  if (existsSync(filePath)) {
    const overwrite = await p.confirm({
      message: `${filename}${ext} already exists. Overwrite?`,
    });

    if (!overwrite || p.isCancel(overwrite)) {
      p.cancel("Cancelled");
      return;
    }
  }

  let content: string;

  if (options.yaml) {
    content = YAML_TASKS_TEMPLATE.replace(/\{\{TASK_1\}\}/g, "First task")
      .replace(/\{\{TASK_2\}\}/g, "Second task")
      .replace(/\{\{TASK_3\}\}/g, "Task depending on first two");
  } else {
    content = PRD_TEMPLATE.replace(/\{\{FEATURE_NAME\}\}/g, featureName)
      .replace(/\{\{TEST_COMMAND\}\}/g, testCommand)
      .replace(/\{\{BUILD_COMMAND\}\}/g, buildCommand)
      .replace(/\{\{TYPECHECK_COMMAND\}\}/g, typecheckCommand);

    if (options.interactive) {
      const tldr = await p.text({
        message: "TL;DR - One sentence describing what you're shipping:",
        placeholder: "Add user authentication with email and OAuth",
      });

      if (p.isCancel(tldr)) {
        p.cancel("Cancelled");
        return;
      }

      const goal = await p.text({
        message: "Primary goal (what outcome should exist when done?):",
        placeholder: "Users can sign up and sign in securely",
      });

      if (p.isCancel(goal)) {
        p.cancel("Cancelled");
        return;
      }

      content = content
        .replace(
          "- Brief one-sentence description of what we're shipping",
          `- ${tldr}`,
        )
        .replace(
          "- What outcome should exist when done?\n- Be specific and measurable\n- Define success criteria clearly",
          `- ${goal}`,
        );
    }
  }

  await Bun.write(filePath, content);
  console.log(chalk.green(`  ✓ Created ${filePath}`));
  console.log();
  console.log(chalk.gray("  Next steps:"));
  console.log(chalk.gray("  1. Edit the PRD file with your requirements"));
  console.log(chalk.gray("  2. Run Ralphy:"));
  if (options.yaml) {
    console.log(
      chalk.cyan(`     dx ralph run --yaml docs/prd/${filename}.yaml`),
    );
  } else {
    console.log(
      chalk.cyan(`     dx ralph run --prd docs/prd/${filename}.prd.md`),
    );
  }
}

async function runRalphy(options: {
  prd?: string;
  yaml?: string;
  parallel?: boolean;
  maxParallel?: number;
  fast?: boolean;
  branchPerTask?: boolean;
  createPr?: boolean;
  draftPr?: boolean;
  maxIterations?: number;
  dryRun?: boolean;
  verbose?: boolean;
}) {
  // Check if ralphy.sh is installed
  if (!existsSync(RALPHY_SCRIPT)) {
    console.log(chalk.yellow("  Ralphy not installed. Installing now..."));
    await installRalphy();
  }

  // Find Git Bash
  const gitBash = findGitBash();
  if (!gitBash) {
    console.log(chalk.red("  ERROR: Git Bash not found."));
    console.log(
      chalk.yellow(
        "  Install Git for Windows: https://git-scm.com/download/win",
      ),
    );
    process.exit(1);
  }

  // Build arguments
  const args: string[] = ["--opencode"];

  if (options.yaml) {
    args.push("--yaml", options.yaml);
  } else if (options.prd) {
    args.push("--prd", options.prd);
  } else {
    args.push("--prd", "PRD.md");
  }

  if (options.parallel) {
    args.push("--parallel");
    args.push("--max-parallel", String(options.maxParallel || 3));
  }

  if (options.fast) {
    args.push("--fast");
  }

  if (options.branchPerTask) {
    args.push("--branch-per-task");
  }

  if (options.createPr) {
    args.push("--create-pr");
  }

  if (options.draftPr) {
    args.push("--draft-pr");
  }

  if (options.maxIterations && options.maxIterations > 0) {
    args.push("--max-iterations", String(options.maxIterations));
  }

  if (options.dryRun) {
    args.push("--dry-run");
  }

  if (options.verbose) {
    args.push("--verbose");
  }

  // Convert Windows path to Unix path
  const unixScript = RALPHY_SCRIPT.replace(/\\/g, "/").replace(/^C:/, "/c");

  console.log();
  console.log(chalk.cyan("  RALPHY - Autonomous AI Coding Loop"));
  console.log(chalk.gray(`  Engine: OpenCode`));
  console.log(chalk.gray(`  PRD: ${options.yaml || options.prd || "PRD.md"}`));
  if (options.parallel) {
    console.log(
      chalk.gray(`  Mode: Parallel (${options.maxParallel || 3} agents)`),
    );
  }
  console.log();

  // Run ralphy.sh through Git Bash
  const child = spawn(gitBash, ["-c", `"${unixScript}" ${args.join(" ")}`], {
    stdio: "inherit",
    shell: false,
  });

  return new Promise<void>((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Ralphy exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

// ============================================================================
// MAIN COMMAND
// ============================================================================

export const ralphCommand = new Command("ralph")
  .description(
    "Ralphy orchestration companion - autonomous AI coding loops with OpenCode",
  )
  .addHelpText(
    "after",
    `
${chalk.white("Examples:")}
  ${chalk.cyan("dx ralph init")}                Initialize project for Ralphy
  ${chalk.cyan("dx ralph install")}             Install/update ralphy.sh
  ${chalk.cyan("dx ralph new auth")}            Create a new PRD
  ${chalk.cyan("dx ralph run")}                 Run Ralphy with OpenCode
  ${chalk.cyan("dx ralph run --parallel")}      Run with parallel agents
  ${chalk.cyan("dx ralph run --create-pr")}     Auto-create pull requests

${chalk.white("What is Ralphy?")}
  An autonomous bash script that runs AI coding agents in a loop until
  your PRD is complete. It supports parallel execution via git worktrees,
  automatic branch/PR creation, and multiple AI engines.

${chalk.white("Workflow:")}
  1. dx ralph init              # Setup project
  2. dx ralph new my-feature    # Create PRD
  3. Edit docs/prd/my-feature.prd.md
  4. dx ralph run --prd docs/prd/my-feature.prd.md

${chalk.white("Learn more:")}
  https://github.com/michaelshimeles/ralphy
`,
  );

// Subcommand: init
ralphCommand
  .command("init")
  .description("Initialize project for Ralphy")
  .option("-f, --force", "Overwrite existing files")
  .option("-p, --path <path>", "Project path (default: current directory)")
  .action(async (options) => {
    console.log();
    p.intro(chalk.bgMagenta(chalk.white(" Ralphy - Initialize Project ")));

    const projectPath = options.path || process.cwd();

    if (!existsSync(projectPath)) {
      p.cancel(`Directory not found: ${projectPath}`);
      process.exit(1);
    }

    console.log(chalk.gray(`  Project: ${projectPath}`));
    console.log();

    await initRalph(projectPath, options);

    console.log();
    p.outro(chalk.green("Project initialized for Ralphy!"));

    console.log();
    console.log(chalk.white("  Next steps:"));
    console.log(
      chalk.gray("  1. Review AGENTS.md and customize for your project"),
    );
    console.log(
      chalk.gray("  2. Review .ralph/signs.md and add project rules"),
    );
    console.log(chalk.gray("  3. Edit PRD.md or create a new PRD:"));
    console.log(chalk.cyan("     dx ralph new my-feature"));
    console.log(chalk.gray("  4. Run Ralphy:"));
    console.log(chalk.cyan("     dx ralph run"));
    console.log();
  });

// Subcommand: install
ralphCommand
  .command("install")
  .description("Install or update ralphy.sh")
  .action(async () => {
    console.log();
    p.intro(chalk.bgMagenta(chalk.white(" Ralphy - Install ")));

    try {
      const { ralphyDir } = await installRalphy();

      console.log();
      p.outro(chalk.green("Ralphy installed successfully!"));

      console.log();
      console.log(chalk.white("  To use from any terminal, add to PATH:"));
      console.log(chalk.cyan(`  ${ralphyDir}`));
      console.log();
      console.log(chalk.white("  Or use through dx:"));
      console.log(chalk.cyan("  dx ralph run"));
      console.log();
    } catch (error) {
      p.cancel(`Installation failed: ${error}`);
      process.exit(1);
    }
  });

// Subcommand: new
ralphCommand
  .command("new")
  .description("Create a new PRD file from template")
  .argument("<name>", "Feature name for the PRD")
  .option("-i, --interactive", "Interactive mode - ask for details")
  .option("-y, --yaml", "Create YAML task file instead of markdown PRD")
  .option("-p, --path <path>", "Project path (default: current directory)")
  .action(async (name, options) => {
    console.log();
    p.intro(chalk.bgMagenta(chalk.white(" Ralphy - New PRD ")));

    const projectPath = options.path || process.cwd();

    await createNewPrd(projectPath, name, options);

    console.log();
    p.outro(chalk.green("PRD created!"));
  });

// Subcommand: run
ralphCommand
  .command("run")
  .description("Run Ralphy with OpenCode")
  .option("--prd <file>", "PRD file path (default: PRD.md)")
  .option("--yaml <file>", "Use YAML task file instead")
  .option("--parallel", "Run tasks in parallel using git worktrees")
  .option("--max-parallel <n>", "Max concurrent agents (default: 3)", parseInt)
  .option("--fast", "Skip tests and linting")
  .option("--branch-per-task", "Create a git branch for each task")
  .option("--create-pr", "Create pull requests automatically")
  .option("--draft-pr", "Create PRs as drafts")
  .option("--max-iterations <n>", "Max iterations (0 = unlimited)", parseInt)
  .option("--dry-run", "Preview without executing")
  .option("-v, --verbose", "Show debug output")
  .action(async (options) => {
    console.log();
    p.intro(chalk.bgMagenta(chalk.white(" Ralphy - Run ")));

    try {
      await runRalphy(options);
      console.log();
      p.outro(chalk.green("Ralphy completed!"));
    } catch (error) {
      p.cancel(`Ralphy failed: ${error}`);
      process.exit(1);
    }
  });

// Subcommand: status
ralphCommand
  .command("status")
  .description("Check Ralphy setup status")
  .option("-p, --path <path>", "Project path (default: current directory)")
  .action(async (options) => {
    console.log();
    p.intro(chalk.bgMagenta(chalk.white(" Ralphy - Status ")));

    const projectPath = options.path || process.cwd();
    const { stack } = detectProjectStack(projectPath);

    console.log(chalk.gray(`  Project: ${basename(projectPath)}`));
    console.log(chalk.gray(`  Stack: ${stack}`));
    console.log();

    // Check ralphy.sh installation
    console.log(chalk.white("  Ralphy Installation:"));
    if (existsSync(RALPHY_SCRIPT)) {
      console.log(chalk.green("    ✓ ralphy.sh installed"));
    } else {
      console.log(chalk.red("    ✗ ralphy.sh not installed"));
      console.log(chalk.gray("      Run: dx ralph install"));
    }

    const gitBash = findGitBash();
    if (gitBash) {
      console.log(chalk.green("    ✓ Git Bash found"));
    } else {
      console.log(chalk.red("    ✗ Git Bash not found"));
    }

    console.log();

    // Check project files
    const checks = [
      { path: "AGENTS.md", name: "AGENTS.md" },
      { path: ".ralph/signs.md", name: ".ralph/signs.md" },
      { path: "PRD.md", name: "PRD.md" },
      { path: "progress.txt", name: "progress.txt" },
      { path: "docs/prd", name: "docs/prd/" },
    ];

    console.log(chalk.white("  Project files:"));
    let allPresent = true;
    for (const check of checks) {
      const exists = existsSync(join(projectPath, check.path));
      if (exists) {
        console.log(chalk.green(`    ✓ ${check.name}`));
      } else {
        console.log(chalk.red(`    ✗ ${check.name}`));
        allPresent = false;
      }
    }

    // Check PRD files
    const prdDir = join(projectPath, "docs", "prd");
    if (existsSync(prdDir)) {
      const prdFiles = readdirSync(prdDir).filter(
        (f) => f.endsWith(".prd.md") || f.endsWith(".yaml"),
      );
      if (prdFiles.length > 0) {
        console.log();
        console.log(chalk.white(`  PRD files: ${prdFiles.length}`));
        for (const file of prdFiles.slice(0, 5)) {
          console.log(chalk.gray(`    - ${file}`));
        }
        if (prdFiles.length > 5) {
          console.log(chalk.gray(`    ... and ${prdFiles.length - 5} more`));
        }
      }
    }

    console.log();
    if (allPresent && existsSync(RALPHY_SCRIPT) && gitBash) {
      p.outro(chalk.green("Ready to run Ralphy!"));
      console.log();
      console.log(chalk.cyan("  dx ralph run"));
      console.log();
    } else {
      p.outro(
        chalk.yellow(
          "Run 'dx ralph init' and 'dx ralph install' to complete setup",
        ),
      );
    }
  });

// Subcommand: help (comprehensive documentation)
ralphCommand
  .command("help")
  .description("Show comprehensive Ralphy documentation")
  .option("-e, --export [file]", "Export documentation as markdown file")
  .option("-s, --section <name>", "Show specific section only")
  .action(async (options) => {
    // Export to file if requested
    if (options.export) {
      const filename =
        typeof options.export === "string" ? options.export : "RALPHY-GUIDE.md";

      const exportPath = join(process.cwd(), filename);
      await Bun.write(exportPath, RALPHY_FULL_DOCS);

      console.log();
      p.intro(chalk.bgMagenta(chalk.white(" Ralphy - Export Documentation ")));
      console.log(chalk.green(`  ✓ Exported to ${exportPath}`));
      console.log();
      p.outro(chalk.gray("Open in your editor or use with AI agents"));
      return;
    }

    // Show specific section if requested
    if (options.section) {
      const sectionName = options.section.toLowerCase();
      const sections: Record<string, string> = {
        tldr: "## TL;DR",
        hot: "## Hot Sessions",
        architecture: "## Architecture Overview",
        files: "## File Architecture",
        prd: "## PRD Format Specification",
        commands: "## Command Reference",
        loop: "## The Ralph Loop",
        commandments: "## Ralph's Commandments",
        convert: "## AI Agent Prompt for Converting PRDs",
        troubleshooting: "## Troubleshooting",
        best: "## Best Practices",
      };

      const sectionHeader = sections[sectionName];
      if (!sectionHeader) {
        console.log(chalk.red(`  Unknown section: ${options.section}`));
        console.log(
          chalk.gray(
            "  Available sections: " + Object.keys(sections).join(", "),
          ),
        );
        return;
      }

      // Extract section content
      const startIndex = RALPHY_FULL_DOCS.indexOf(sectionHeader);
      if (startIndex === -1) {
        console.log(chalk.red(`  Section not found: ${options.section}`));
        return;
      }

      // Find next section of same or higher level (## at start of line, not in code blocks)
      // Look for \n## followed by a capital letter and not inside code blocks
      const afterSection = RALPHY_FULL_DOCS.substring(
        startIndex + sectionHeader.length,
      );

      // Find all ## headers and pick the first one that's not inside a code block
      let nextSectionIndex = -1;
      let inCodeBlock = false;
      const lines = afterSection.split("\n");
      let charCount = 0;

      for (const line of lines) {
        if (line.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
        }
        if (!inCodeBlock && line.match(/^## [A-Z]/)) {
          nextSectionIndex = charCount;
          break;
        }
        charCount += line.length + 1; // +1 for newline
      }

      const endIndex =
        nextSectionIndex === -1
          ? RALPHY_FULL_DOCS.length
          : startIndex + sectionHeader.length + nextSectionIndex;

      const sectionContent = RALPHY_FULL_DOCS.substring(startIndex, endIndex);
      console.log(formatForTerminal(sectionContent));
      return;
    }

    // Show full documentation in terminal with paging
    console.log();
    p.intro(
      chalk.bgMagenta(chalk.white(" Ralphy - Complete Reference Guide ")),
    );
    console.log();
    console.log(chalk.gray("  Tip: Use --export to save as markdown file"));
    console.log(
      chalk.gray("  Tip: Use --section <name> for specific sections"),
    );
    console.log(
      chalk.gray(
        "  Sections: tldr, hot, architecture, files, prd, commands, loop, commandments, convert, troubleshooting, best",
      ),
    );
    console.log();

    // Show formatted documentation
    const formatted = formatForTerminal(RALPHY_FULL_DOCS);
    console.log(formatted);

    console.log();
    p.outro(chalk.green("End of documentation"));
  });
