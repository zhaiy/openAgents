import type { ToolDefinition } from '../types/index.js';

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface MCPToolMetadata {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPLoaderDeps {
  servers: MCPServerConfig[];
}

/**
 * MCP Loader - loads and calls MCP (Model Context Protocol) tools
 */
export class MCPLoader {
  private serverProcesses: Map<string, ChildProcess> = new Map();
  private connectedServers: Map<string, boolean> = new Map();

  constructor(private readonly deps: MCPLoaderDeps) {}

  /**
   * Initialize MCP server connections
   */
  async initialize(): Promise<void> {
    // In MVP, we assume servers are already running or use stdio connection
    // Future: spawn and manage MCP server processes
  }

  /**
   * Get list of available tools from an MCP server
   */
  async listTools(_serverName: string): Promise<MCPToolMetadata[]> {
    void _serverName;
    // MCP protocol: send tools/list request
    // For MVP, return empty - tools are statically defined in agent config
    return [];
  }

  /**
   * Convert MCP tool to ToolDefinition format for LLM
   */
  toToolDefinition(serverName: string, toolName: string, metadata: MCPToolMetadata): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: `${serverName}_${toolName}`,
        description: metadata.description,
        parameters: metadata.inputSchema,
      },
    };
  }

  /**
   * Call an MCP tool and return the result
   */
  async callTool(
    serverName: string,
    _toolName: string,
    _args: Record<string, unknown>,
  ): Promise<string> {
    void _toolName;
    void _args;
    // MCP protocol: send tools/call request
    // For MVP, throw not implemented - actual MCP integration requires
    // MCP server running with JSON-RPC over stdio or HTTP+SSE
    throw new Error(
      `MCP tool calling requires running MCP servers. ` +
      `Please ensure the MCP server "${serverName}" is running and configured.`,
    );
  }

  /**
   * Create a tool executor function for a given set of MCP tools
   */
  createToolExecutor(mcpTools: Array<{ server: string; tool: string }>): (name: string, args: Record<string, unknown>) => Promise<string> {
    return async (name: string, args: Record<string, unknown>): Promise<string> => {
      // Parse tool name format: serverName_toolName
      const parts = name.split('_');
      if (parts.length < 2) {
        throw new Error(`Invalid MCP tool name format: ${name}. Expected: serverName_toolName`);
      }
      const serverName = parts[0];
      const toolName = parts.slice(1).join('_');

      // Verify this tool is in our allowed list
      const isAllowed = mcpTools.some((t) => t.server === serverName && t.tool === toolName);
      if (!isAllowed) {
        throw new Error(`Tool ${name} is not in the allowed tools list`);
      }

      return this.callTool(serverName, toolName, args);
    };
  }

  /**
   * Shutdown all MCP server connections
   */
  async shutdown(): Promise<void> {
    for (const [name, process] of this.serverProcesses) {
      process.kill();
      this.serverProcesses.delete(name);
    }
    this.connectedServers.clear();
  }
}

// Minimal ChildProcess type for process management
interface ChildProcess {
  kill(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}
