import Anthropic from "@anthropic-ai/sdk";

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const missingEnvVars = [
  !baseURL ? "AI_INTEGRATIONS_ANTHROPIC_BASE_URL" : null,
  !apiKey ? "AI_INTEGRATIONS_ANTHROPIC_API_KEY" : null,
].filter(Boolean) as string[];

function createUnavailableClient(message: string): Anthropic {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(message);
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
    : createUnavailableClient(
        `Anthropic AI integration is not configured (missing ${missingEnvVars.join(
          ", ",
        )}). The API server can still start, but AI-powered endpoints require this integration.`,
      );
