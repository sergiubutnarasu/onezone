import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, networkInterfaces } from "node:os";
import { join } from "node:path";

export interface AgentIdentity {
  agentId: string;
  hostname: string;
  createdAt: string;
}

/**
 * Derives a stable machine fingerprint from MAC address + hostname.
 * Falls back to a random UUID if no MAC is available.
 */
function deriveMachineId(): string {
  const nets = networkInterfaces();
  const macs: string[] = [];
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (!iface.internal && iface.mac && iface.mac !== "00:00:00:00:00:00") {
        macs.push(iface.mac);
      }
    }
  }
  if (macs.length === 0) return randomUUID();

  macs.sort();
  const hash = createHash("sha256")
    .update(macs.join(",") + hostname())
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

/**
 * Reads or creates a persistent agent identity stored in dataDir.
 * On macOS: ~/Library/Application Support/onezone-agent/agent-identity.json
 * On Linux: ~/.local/share/onezone-agent/agent-identity.json
 */
export function getOrCreateAgentIdentity(dataDir: string): AgentIdentity {
  const identityPath = join(dataDir, "agent-identity.json");

  if (existsSync(identityPath)) {
    try {
      const parsed = JSON.parse(readFileSync(identityPath, "utf-8")) as AgentIdentity;
      if (parsed.agentId && typeof parsed.agentId === "string") {
        return parsed;
      }
    } catch {
      // Corrupt file — recreate below
    }
  }

  mkdirSync(dataDir, { recursive: true });

  const identity: AgentIdentity = {
    agentId: deriveMachineId(),
    hostname: hostname(),
    createdAt: new Date().toISOString(),
  };

  writeFileSync(identityPath, JSON.stringify(identity, null, 2), "utf-8");
  return identity;
}
