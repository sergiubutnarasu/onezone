// Fake ACP agent for integration testing the onezone-terminal ACP client.
//
// Speaks the ACP v1 wire protocol over newline-delimited JSON on stdio:
//   - responds to `initialize` and `session/new` requests
//   - streams `session/update` notifications during `session/prompt`
//   - records the model passed via `_meta.claudeCode.options.settings.model`
//
// The client under test is `src/agents/claude-acp/client.ts`; this fixture
// lets us exercise the full spawn -> initialize -> session/new -> prompt ->
// update -> cancel lifecycle without a real model backend.

import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

let sessionId = null;
let modelSeen = null;

function write(message) {
  stdout.write(`${JSON.stringify(message)}\n`);
}

function writeResult(id, result) {
  write({ jsonrpc: '2.0', id, result });
}

function notify(method, params) {
  write({ jsonrpc: '2.0', method, params });
}

function notifyUpdate(update) {
  notify('session/update', { sessionId, update });
}

const rl = createInterface({ input: stdin, crlfDelay: Infinity });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }

  switch (msg.method) {
    case 'initialize': {
      writeResult(msg.id, {
        protocolVersion: 1,
        agentCapabilities: {
          loadSession: false,
          promptCapabilities: { image: false, audio: false, embeddedContext: false },
          mcpCapabilities: { http: false, sse: false, acp: false },
          sessionCapabilities: {},
          auth: {},
        },
        authMethods: [],
        agentInfo: { name: 'fake-agent', version: '0.0.0' },
      });
      break;
    }
    case 'session/new': {
      sessionId = `sess_${msg.id}`;
      modelSeen = msg.params?._meta?.claudeCode?.options?.settings?.model;
      writeResult(msg.id, { sessionId });
      break;
    }
    case 'session/prompt': {
      // Echo the captured model so the test can assert it flowed through
      // `_meta.claudeCode.options.settings.model` on session/new.
      const model = modelSeen ?? 'none';
      notifyUpdate({
        sessionUpdate: 'agent_message_chunk',
        messageId: 'm1',
        content: { type: 'text', text: `hello from fake (model: ${model})` },
      });
      notifyUpdate({
        sessionUpdate: 'usage_update',
        used: 100,
        size: 1000,
        cost: { amount: 0.01, currency: 'USD' },
      });
      writeResult(msg.id, { stopReason: 'end_turn' });
      break;
    }
    case 'session/cancel': {
      // Notification: no response expected. The client aborts the prompt turn.
      break;
    }
    default:
      break;
  }
});
