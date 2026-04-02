import { ReplitConnectors } from "@replit/connectors-sdk";

/**
 * Helper to make GET and POST requests to HubSpot via Replit Connectors.
 */
export function getConnectors() {
  return new ReplitConnectors();
}

export async function hubspotGet(path: string, params?: Record<string, string>): Promise<any> {
  const connectors = getConnectors();
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  const response = await connectors.proxy("hubspot", path + qs, { method: "GET" });
  if (!response.ok) {
    throw new Error(`HubSpot GET ${path} failed: ${response.status}`);
  }
  return response.json();
}

export async function hubspotPost(path: string, body: any): Promise<any> {
  const connectors = getConnectors();
  const response = await connectors.proxy("hubspot", path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HubSpot POST ${path} failed: ${response.status}`);
  }
  return response.json();
}