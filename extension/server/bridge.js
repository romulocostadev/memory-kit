// Claude Desktop talks stdio to this bridge; the bridge talks Streamable HTTP to the instance (<server>/mcp) with the
// person's bearer key, forwarding tools/list and tools/call unchanged, and adds one local tool, memory_kit_whoami,
// that returns the person's reference from the invite. A failed remote call becomes a tool error naming the server;
// the next call reconnects. When tools/list finds the server down, the bridge keeps retrying in the background and
// announces tools/list_changed once it is back, so Claude Desktop picks up the tools without a restart.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { decodeInvite } from "./invite.js";

export const VERSION = "0.1.0";
const WHOAMI = {
  name: "memory_kit_whoami",
  description: "Returns the person's memory reference: workspace, user, role, and the units (ai-memory projects) they "
    + "write and read. Memory skills call this first.",
  inputSchema: { type: "object", properties: {} },
};

export async function startBridge({ invite, transport, retryMs = 30000 }) {
  const { server: base, key, reference } = decodeInvite(invite);
  const endpoint = `${base}/mcp`;
  let remote = null;

  async function connected() {
    if (remote) return remote;
    const client = new Client({ name: "memory-kit", version: VERSION });
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${key}` } },
    }));
    remote = client;
    return client;
  }

  async function withRemote(fn) {
    try {
      return await fn(await connected());
    } catch (err) {
      const old = remote;
      remote = null;
      old?.close().catch(() => {});
      throw new Error(`memory server ${base} did not answer: ${scrub(err?.message ?? String(err), key)}`);
    }
  }

  const server = new Server({ name: "memory-kit", version: VERSION }, { capabilities: { tools: { listChanged: true } } });
  let retry = null;

  function retryUntilBack() {
    if (retry) return;
    retry = setInterval(async () => {
      try {
        await withRemote((c) => c.listTools());
      } catch {
        return;
      }
      clearInterval(retry);
      retry = null;
      server.sendToolListChanged().catch(() => {});
    }, retryMs);
    retry.unref?.();
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const { tools } = await withRemote((c) => c.listTools());
      return { tools: [...tools, WHOAMI] };
    } catch (err) {
      process.stderr.write(`${err.message}\n`);
      retryUntilBack();
      return { tools: [WHOAMI] };
    }
  });
  server.onclose = () => { if (retry) clearInterval(retry); };

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    if (name === WHOAMI.name) return { content: [{ type: "text", text: reference }] };
    try {
      return await withRemote((c) => c.callTool({ name, arguments: args }));
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: err.message }] };
    }
  });

  await server.connect(transport);
  return server;
}

function scrub(text, key) {
  return text.split(key).join("[key]");
}
