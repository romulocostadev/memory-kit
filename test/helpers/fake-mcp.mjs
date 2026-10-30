// A stand-in for an ai-memory instance: an MCP server over Streamable HTTP at /mcp that requires one bearer key,
// plus a /hook endpoint that records lifecycle-hook POSTs. Tests and the installer checks talk to it like the real one.
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

export async function startFakeMcp({ key, port = 0 }) {
  const seen = { calls: [], hooks: [], unauthorized: 0 };

  function mcpServer() {
    const server = new McpServer({ name: "fake-ai-memory", version: "0.0.0" });
    server.registerTool("memory_query", {
      description: "Search the memory.",
      inputSchema: { query: z.string(), global: z.boolean().optional(), limit: z.number().optional() },
    }, async (args) => {
      seen.calls.push({ tool: "memory_query", args });
      return { content: [{ type: "text", text: JSON.stringify({ hits: [], echo: args.query }) }] };
    });
    return server;
  }

  const http = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    if (req.headers.authorization !== `Bearer ${key}`) {
      seen.unauthorized += 1;
      res.writeHead(401, { "content-type": "application/json" }).end('{"error":"unauthorized"}');
      return;
    }
    if (url.pathname === "/hook" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      seen.hooks.push({ event: url.searchParams.get("event"), query: Object.fromEntries(url.searchParams), body });
      res.writeHead(202).end();
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    const server = mcpServer();
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
  });

  await new Promise((resolve) => http.listen(port, "127.0.0.1", resolve));
  const { port: bound } = http.address();
  return {
    url: `http://127.0.0.1:${bound}`,
    port: bound,
    seen,
    close: () => new Promise((resolve) => { http.closeAllConnections?.(); http.close(() => resolve()); }),
  };
}
