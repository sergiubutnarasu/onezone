import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import {
  PROTOCOL_VERSION,
  client as acpClient,
  methods,
  ndJsonStream,
} from '@agentclientprotocol/sdk';
import { resolveAgentEntry } from './entry.js';

export type AcpClient = {
  sessionId: string;
  onUpdate(handler: (update: Record<string, unknown>) => void): void;
  prompt(text: string): Promise<string>;
  cancel(): void;
  dispose(): Promise<void>;
};

export async function createAcpClient(opts: {
  cwd: string;
  workDir: string;
  configPath: string;
  model: string;
  env: NodeJS.ProcessEnv;
}): Promise<AcpClient> {
  const entry = resolveAgentEntry();
  const child = spawn(process.execPath, [entry], {
    cwd: opts.workDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: opts.env,
  });

  child.stdin?.on('error', () => {});
  child.stdout?.on('error', () => {});
  child.stderr?.on('error', () => {});

  const stream = ndJsonStream(
    Writable.toWeb(child.stdin!) as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout!) as unknown as ReadableStream<Uint8Array>,
  );

  const updateHandlers = new Set<(update: Record<string, unknown>) => void>();
  const app = acpClient({ name: 'onezone-terminal' })
    .onNotification(methods.client.session.update, (ctx) => {
      for (const h of updateHandlers) h(ctx.params.update as Record<string, unknown>);
    })
    // Auto-approve every permission request, mirroring today's allow-list.
    .onRequest(methods.client.session.requestPermission, (ctx) => {
      const option = ctx.params.options.find((o) => o.kind === 'allow_once') ?? ctx.params.options[0];
      if (!option) return { outcome: { outcome: 'cancelled' } };
      return { outcome: { outcome: 'selected', optionId: option.optionId } };
    })
    .onRequest(methods.client.fs.readTextFile, () => ({ content: '' }))
    .onRequest(methods.client.fs.writeTextFile, () => ({}))
    .connect(stream);

  const agent = app.agent;

  await agent.request(methods.agent.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: false,
    },
    clientInfo: { name: 'onezone-terminal', version: '0.0.1' },
  });

  const session = await agent.request(methods.agent.session.new, {
    cwd: opts.cwd,
    additionalDirectories: [opts.configPath],
    mcpServers: [],
    _meta: {
      claudeCode: {
        options: {
          settings: { model: opts.model },
        },
      },
    },
  });

  const sessionId = session.sessionId;
  const chunks: string[] = [];

  return {
    sessionId,
    onUpdate(handler) {
      updateHandlers.add(handler);
    },
    async prompt(text: string): Promise<string> {
      chunks.length = 0;
      const result = await agent.request(methods.agent.session.prompt, {
        sessionId,
        prompt: [{ type: 'text', text }],
      });
      return result.stopReason === 'cancelled' ? '' : chunks.join('');
    },
    cancel() {
      void agent.notify(methods.agent.session.cancel, { sessionId });
    },
    async dispose() {
      child.stdin?.end();
      if (!child.killed) child.kill();
      app.close();
    },
  };
}
