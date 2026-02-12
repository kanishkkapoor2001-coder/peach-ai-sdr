/**
 * AI Provider Configuration
 *
 * Configure via environment variables:
 *
 * AI_PROVIDER - Choose your AI provider:
 *   - "anthropic" (default) - Uses Claude (requires ANTHROPIC_API_KEY)
 *   - "openai" - Uses GPT-4 (requires OPENAI_API_KEY)
 *   - "google" - Uses Gemini (requires GOOGLE_GENERATIVE_AI_API_KEY)
 *
 * AI_MODEL - Override the default model (optional):
 *   - Anthropic: "claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-3-20240307"
 *   - OpenAI: "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini"
 *   - Google: "gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"
 *
 * AI_MODEL_FAST - Override the fast model for quick tasks (optional)
 */

import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

export type AIProvider = "anthropic" | "openai" | "google";

// Get the configured provider from environment
export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase() || "anthropic";

  if (provider === "openai" || provider === "google" || provider === "anthropic") {
    return provider;
  }

  console.warn(`Unknown AI_PROVIDER "${provider}", defaulting to anthropic`);
  return "anthropic";
}

// Default model mappings for each provider
const DEFAULT_MODELS = {
  anthropic: {
    default: "claude-sonnet-4-20250514",
    fast: "claude-haiku-3-20240307",
  },
  openai: {
    default: "gpt-4o",
    fast: "gpt-4o-mini",
  },
  google: {
    default: "gemini-2.0-flash",
    fast: "gemini-2.0-flash",
  },
} as const;

/**
 * Get the model name for the current provider
 * Uses AI_MODEL env var if set, otherwise uses default for the provider
 */
export function getModelName(speed: "default" | "fast" = "default"): string {
  const provider = getAIProvider();

  // Check for environment variable override
  if (speed === "default" && process.env.AI_MODEL) {
    return process.env.AI_MODEL;
  }
  if (speed === "fast" && process.env.AI_MODEL_FAST) {
    return process.env.AI_MODEL_FAST;
  }

  // Use default for provider
  return DEFAULT_MODELS[provider][speed];
}

/**
 * Get the AI model for the current provider
 * @param speed - "default" for best quality, "fast" for speed/cost optimization
 */
export function getModel(speed: "default" | "fast" = "default"): LanguageModel {
  const provider = getAIProvider();
  const modelName = getModelName(speed);

  switch (provider) {
    case "anthropic":
      return anthropic(modelName);
    case "openai":
      return openai(modelName);
    case "google":
      return google(modelName);
    default:
      return anthropic(modelName);
  }
}

/**
 * Get provider display name for logging
 */
export function getProviderName(): string {
  const provider = getAIProvider();
  const names = {
    anthropic: "Anthropic Claude",
    openai: "OpenAI GPT-4",
    google: "Google Gemini",
  };
  return names[provider];
}

/**
 * Check if the required API key is configured for the current provider
 */
export function isProviderConfigured(): boolean {
  const provider = getAIProvider();

  switch (provider) {
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY &&
             process.env.ANTHROPIC_API_KEY !== "YOUR_ANTHROPIC_API_KEY_HERE";
    case "openai":
      return !!process.env.OPENAI_API_KEY &&
             process.env.OPENAI_API_KEY !== "YOUR_OPENAI_API_KEY_HERE";
    case "google":
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY &&
             process.env.GOOGLE_GENERATIVE_AI_API_KEY !== "YOUR_GOOGLE_API_KEY_HERE";
    default:
      return false;
  }
}

/**
 * Get the required environment variable name for the current provider
 */
export function getRequiredEnvVar(): string {
  const provider = getAIProvider();

  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "google":
      return "GOOGLE_GENERATIVE_AI_API_KEY";
    default:
      return "ANTHROPIC_API_KEY";
  }
}

/**
 * Get a summary of current AI configuration for logging
 */
export function getAIConfigSummary(): string {
  const provider = getProviderName();
  const model = getModelName("default");
  const configured = isProviderConfigured();

  return `Provider: ${provider} | Model: ${model} | Configured: ${configured ? "Yes" : "No (missing API key)"}`;
}
