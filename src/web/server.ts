import http from 'node:http';

import { buildWebContext, type WebAppContext } from '../app/context.js';
import { WebRouter } from './routes.js';

export interface WebServerOptions {
  host?: string;
  port?: number;
  context?: WebAppContext;
}

export class WebServer {
  private server: http.Server | null = null;
  private readonly context: WebAppContext;
  private readonly router: WebRouter;
  private readonly host: string;
  private readonly port: number;

  constructor(options: WebServerOptions = {}) {
    this.host = options.host ?? '127.0.0.1';
    this.port = options.port ?? 3456;
    this.context = options.context ?? buildWebContext();
    this.router = new WebRouter(this.context);
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }
    this.server = http.createServer(async (req, res) => {
      const handled = await this.router.handle(req, res);
      if (handled) {
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { message: 'Not Found' } }));
    });

    await new Promise<void>((resolve) => {
      this.server?.listen(this.port, this.host, () => resolve());
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}
