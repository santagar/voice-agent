declare module "ws" {
  export default class WebSocket {
    constructor(url: string, options?: unknown);
    send(data: unknown): void;
    close(): void;
    readyState: number;
    on(event: string, listener: (...args: any[]) => void): void;
  }

  export class WebSocketServer {
    constructor(options: { port: number }, callback?: () => void);
    on(event: "connection", listener: (socket: WebSocket) => void): void;
  }
}

