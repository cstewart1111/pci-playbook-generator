#!/usr/bin/env tsx
import Anthropic from '@anthropic-ai/sdk';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import fetch from 'node-fetch';
import { z } from 'zod';

/**
 * Tool to call our Optimize Travel API endpoint.
 */
const optimizeTravelTool = betaZodTool({
  name: 'optimize_travel',
  description: 'Optimize travel itinerary for a given date and optional home base.',
  inputSchema: z.object({
    date: z.string().describe('Date in YYYY-MM-DD format'),
    homeBase: z.string().optional().describe('Starting address for the route'),
  }),
  run: async ({ date, homeBase }) => {
    const params = new URLSearchParams({ date });
    if (homeBase) {
      params.set('homeBase', homeBase);
    }
    const port = process.env.PORT || '3000';
    const url = `http://localhost:${port}/api/travel/optimize-travel?${params}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API call failed ${res.status}: ${text}`);
    }
    return JSON.stringify(await res.json());
  },
});

/**
 * Entry point: runs an interactive Claude call with our travel tool.
 */
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Missing ANTHROPIC_API_KEY');
    process.exit(1);
  }
  const anthropic = new Anthropic({ apiKey });
  const userQuery = process.argv.slice(2).join(' ') ||
    'Optimize my travel for 2026-04-03 starting at \'123 Main St, Anywhere\'';

  const runner = anthropic.beta.messages.toolRunner({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content: userQuery }],
    tools: [optimizeTravelTool],
  });

  const finalMessage = await runner.runUntilDone();
  for (const block of finalMessage.content) {
    if (block.type === 'text') {
      console.log(block.text);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
