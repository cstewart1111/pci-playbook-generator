/**
 * Vercel serverless entry point.
 *
 * The api-server build produces two bundles:
 *   dist/index.mjs — full server with app.listen() (used by Replit)
 *   dist/app.mjs   — Express app only, no listen() (used here)
 *
 * Vercel calls the default export directly for each request; it handles
 * the Node.js HTTP plumbing, so we just hand it the Express app.
 */
export { default } from "../artifacts/api-server/dist/app.mjs";
