#!/usr/bin/env node
// Entry point Claude Desktop runs: the invite comes from the extension's sensitive user_config (MEMORY_KIT_INVITE).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startBridge } from "./bridge.js";

try {
  await startBridge({ invite: process.env.MEMORY_KIT_INVITE, transport: new StdioServerTransport() });
} catch (err) {
  process.stderr.write(`memory-kit: ${err.message}\n`);
  process.exit(1);
}
