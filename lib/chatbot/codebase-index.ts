/**
 * Codebase Indexer for AI Chatbot
 *
 * Creates an in-memory index of the codebase that can be queried
 * by the chatbot to answer questions about the application.
 */

import fs from "fs";
import path from "path";

export interface CodeChunk {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  type: "component" | "api" | "service" | "lib" | "config" | "schema" | "other";
  description?: string;
}

// Files/directories to ignore
const IGNORE_PATTERNS = [
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  ".env",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ".DS_Store",
  "*.log",
  "*.map",
];

// File extensions to index
const INCLUDE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".json",
];

// Maximum file size to index (in bytes)
const MAX_FILE_SIZE = 100000; // 100KB

/**
 * Determine the type of code chunk based on file path
 */
function getChunkType(filePath: string): CodeChunk["type"] {
  const normalizedPath = filePath.replace(/\\/g, "/");

  if (normalizedPath.includes("/components/")) return "component";
  if (normalizedPath.includes("/app/api/")) return "api";
  if (normalizedPath.includes("/lib/services/")) return "service";
  if (normalizedPath.includes("/lib/")) return "lib";
  if (normalizedPath.includes("/db/schema")) return "schema";
  if (
    normalizedPath.endsWith(".config.ts") ||
    normalizedPath.endsWith(".config.js") ||
    normalizedPath.includes("/config/")
  ) return "config";

  return "other";
}

/**
 * Generate a description for the code chunk
 */
function generateDescription(filePath: string, content: string): string {
  const fileName = path.basename(filePath);
  const type = getChunkType(filePath);

  // Extract JSDoc comments or first comment block
  const jsdocMatch = content.match(/\/\*\*[\s\S]*?\*\//);
  if (jsdocMatch) {
    const cleanedComment = jsdocMatch[0]
      .replace(/\/\*\*|\*\//g, "")
      .replace(/^\s*\*\s?/gm, "")
      .trim()
      .split("\n")[0]; // First line only
    return cleanedComment;
  }

  // Extract first single-line comment
  const commentMatch = content.match(/^\/\/\s*(.+)$/m);
  if (commentMatch) {
    return commentMatch[1];
  }

  // Generate based on file name and type
  const baseName = fileName.replace(/\.(tsx?|jsx?|md|json)$/, "");
  switch (type) {
    case "api":
      return `API route handler for ${baseName}`;
    case "component":
      return `React component: ${baseName}`;
    case "service":
      return `Service module: ${baseName}`;
    case "schema":
      return `Database schema definitions`;
    default:
      return `${baseName} module`;
  }
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");

  return IGNORE_PATTERNS.some((pattern) => {
    if (pattern.startsWith("*.")) {
      return normalizedPath.endsWith(pattern.slice(1));
    }
    return normalizedPath.includes(pattern);
  });
}

/**
 * Recursively scan directory and collect files
 */
function scanDirectory(dir: string, baseDir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (shouldIgnore(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...scanDirectory(fullPath, baseDir));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (INCLUDE_EXTENSIONS.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }

  return files;
}

/**
 * Create a codebase index from a directory
 */
export function createCodebaseIndex(rootDir: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const files = scanDirectory(rootDir, rootDir);

  for (const filePath of files) {
    try {
      const stats = fs.statSync(filePath);

      // Skip files that are too large
      if (stats.size > MAX_FILE_SIZE) {
        continue;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const relativePath = path.relative(rootDir, filePath);

      const chunk: CodeChunk = {
        id: relativePath.replace(/[\/\\]/g, "_"),
        filePath: relativePath,
        fileName: path.basename(filePath),
        content,
        type: getChunkType(relativePath),
        description: generateDescription(relativePath, content),
      };

      chunks.push(chunk);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
    }
  }

  return chunks;
}

/**
 * Search the codebase index for relevant chunks
 */
export function searchCodebase(
  index: CodeChunk[],
  query: string,
  maxResults: number = 10
): CodeChunk[] {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  // Score each chunk based on relevance
  const scored = index.map((chunk) => {
    let score = 0;

    const contentLower = chunk.content.toLowerCase();
    const filePathLower = chunk.filePath.toLowerCase();
    const descriptionLower = (chunk.description || "").toLowerCase();

    // Check for exact phrase match
    if (contentLower.includes(queryLower)) {
      score += 10;
    }

    // Check for term matches
    for (const term of queryTerms) {
      // File path match (high weight)
      if (filePathLower.includes(term)) {
        score += 5;
      }

      // Description match (high weight)
      if (descriptionLower.includes(term)) {
        score += 4;
      }

      // Content match
      const matches = (contentLower.match(new RegExp(term, "g")) || []).length;
      score += Math.min(matches, 5); // Cap at 5 to avoid over-weighting
    }

    // Boost API routes, services, and components
    if (chunk.type === "api") score += 2;
    if (chunk.type === "service") score += 2;
    if (chunk.type === "component") score += 1;

    return { chunk, score };
  });

  // Sort by score and return top results
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.chunk);
}

/**
 * Get a summary of the codebase structure
 */
export function getCodebaseSummary(index: CodeChunk[]): string {
  const byType: Record<string, number> = {};
  const apiRoutes: string[] = [];
  const services: string[] = [];
  const components: string[] = [];

  for (const chunk of index) {
    byType[chunk.type] = (byType[chunk.type] || 0) + 1;

    if (chunk.type === "api") {
      // Extract route from path
      const routeMatch = chunk.filePath.match(/app\/api\/(.+?)\/route\.(ts|js)/);
      if (routeMatch) {
        apiRoutes.push(`/api/${routeMatch[1]}`);
      }
    } else if (chunk.type === "service") {
      services.push(chunk.fileName.replace(/\.(ts|js)$/, ""));
    } else if (chunk.type === "component") {
      components.push(chunk.fileName.replace(/\.(tsx|jsx)$/, ""));
    }
  }

  return `
Codebase Summary:
- Total files indexed: ${index.length}
- Components: ${byType.component || 0}
- API Routes: ${byType.api || 0}
- Services: ${byType.service || 0}
- Library modules: ${byType.lib || 0}

API Routes:
${apiRoutes.slice(0, 20).map((r) => `  - ${r}`).join("\n")}

Services:
${services.slice(0, 10).map((s) => `  - ${s}`).join("\n")}

Key Components:
${components.slice(0, 10).map((c) => `  - ${c}`).join("\n")}
`.trim();
}

// Singleton instance of the index
let codebaseIndex: CodeChunk[] | null = null;

/**
 * Get or create the codebase index
 */
export function getCodebaseIndex(rootDir?: string): CodeChunk[] {
  if (!codebaseIndex) {
    const dir = rootDir || process.cwd();
    console.log(`[Chatbot] Indexing codebase at: ${dir}`);
    codebaseIndex = createCodebaseIndex(dir);
    console.log(`[Chatbot] Indexed ${codebaseIndex.length} files`);
  }
  return codebaseIndex;
}

/**
 * Clear the cached index (useful for development)
 */
export function clearCodebaseIndex(): void {
  codebaseIndex = null;
}
