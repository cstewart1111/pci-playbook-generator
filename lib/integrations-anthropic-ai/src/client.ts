import Anthropic from "@anthropic-ai/sdk";

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const missingEnvVars = [
  !baseURL ? "AI_INTEGRATIONS_ANTHROPIC_BASE_URL" : null,
  !apiKey ? "AI_INTEGRATIONS_ANTHROPIC_API_KEY" : null,
].filter(Boolean) as string[];

export class AnthropicIntegrationUnavailableError extends Error {
  readonly code = "ANTHROPIC_INTEGRATION_UNAVAILABLE";

  constructor(missingVars: string[]) {
    super(
      `Anthropic AI integration is not configured (missing ${missingVars.join(
        ", ",
      )}). The API server can still start, but AI-powered endpoints require this integration.`,
    );
    this.name = "AnthropicIntegrationUnavailableError";
  }
}

export function isAnthropicIntegrationUnavailableError(
  error: unknown,
): error is AnthropicIntegrationUnavailableError {
  if (error instanceof AnthropicIntegrationUnavailableError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const errorWithCode = error as Error & { code?: string };
  return (
    error.name === "AnthropicIntegrationUnavailableError" ||
    errorWithCode.code === "ANTHROPIC_INTEGRATION_UNAVAILABLE"
  );
}

function createUnavailableClient(missingVars: string[]): Anthropic {
  return new Proxy(
    {},
    {
      get() {
        throw new AnthropicIntegrationUnavailableError(missingVars);
      },
    },
  ) as Anthropic;
}

export const anthropic =
  missingEnvVars.length === 0
    ? new Anthropic({
        apiKey,
        baseURL,
      })
    : createUnavailableClient(missingEnvVars);
