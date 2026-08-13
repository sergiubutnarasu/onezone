import { describe, it, expect } from 'vitest';
import { AgentTag } from '@onezone/shared';
import { agentFactory, setupTerminalAgent } from './setup.js';

describe('agents/setup', () => {
  describe('agentFactory', () => {
    it('returns a config for claude-code', () => {
      const cfg = agentFactory({ projectId: 'p1', agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' }, model: 'm' });
      expect(cfg).not.toBeNull();
      expect(cfg!.tag).toBe(AgentTag.ClaudeCode);
    });
    it('returns a config for github-copilot-cli', () => {
      const cfg = agentFactory({ projectId: 'p1', agent: { tag: AgentTag.GithubCopilotCLI, id: 'a2', name: 'Copilot' }, model: 'm' });
      expect(cfg).not.toBeNull();
      expect(cfg!.tag).toBe(AgentTag.GithubCopilotCLI);
    });
    it('returns a config for opencode', () => {
      const cfg = agentFactory({ projectId: 'p1', agent: { tag: AgentTag.Opencode, id: 'a3', name: 'Opencode' }, model: 'm' });
      expect(cfg).not.toBeNull();
      expect(cfg!.tag).toBe(AgentTag.Opencode);
    });
    it('returns null for unknown tag', () => {
      const cfg = agentFactory({ projectId: 'p1', agent: { tag: 'unknown' as AgentTag, id: 'a4', name: 'X' }, model: 'm' });
      expect(cfg).toBeNull();
    });
    it('returns null when agent is null', () => {
      const result = agentFactory({
        projectId: 'proj-1',
        agent: null,
        model: 'any-model',
      });
      expect(result).toBeNull();
    });
  });

  describe('setupTerminalAgent', () => {
    it('returns config for valid task payload', () => {
      const payload = {
        task: {
          id: 'task-1',
          name: 'Test',
          columnId: null,
          agentId: 'agent-1',
          agent: { id: 'agent-1', name: 'Claude', tag: AgentTag.ClaudeCode },
          model: 'claude-model',
          useTaskAgentAndModel: true,
          bypass: false,
          projectId: 'proj-1',
          project: {
            id: 'proj-1',
            name: 'Test Project',
            status: 'ready' as const,
            defaultAgentId: 'agent-1',
            defaultAgent: { id: 'agent-1', name: 'Claude', tag: AgentTag.ClaudeCode },
            defaultModel: 'default-model',
            skills: [],
            createdAt: '2024-01-01T00:00:00Z',
            kanbanColumns: [],
          },
          column: null,
        },
      };

      const result = setupTerminalAgent(payload);
      expect(result).toBeDefined();
      expect(result?.config).toBeDefined();
      expect(result?.agentId).toBe('agent-1');
      expect(result?.agentName).toBe('Claude');
      expect(result?.model).toBe('claude-model');
    });

    it('returns null when payload has no task', () => {
      expect(setupTerminalAgent({})).toBeNull();
    });

    it('returns null when task is not an object', () => {
      expect(setupTerminalAgent({ task: 'invalid' })).toBeNull();
    });

    it('returns null when task has no project', () => {
      expect(setupTerminalAgent({ task: { id: 'task-1' } })).toBeNull();
    });

    it('returns null when project has no id', () => {
      expect(
        setupTerminalAgent({ task: { project: { name: 'No ID' } } }),
      ).toBeNull();
    });

    it('returns null when effective agent is not an object', () => {
      expect(
        setupTerminalAgent({
          task: {
            id: 'task-1',
            project: { id: 'proj-1' },
            agent: null,
          },
        }),
      ).toBeNull();
    });

    it('returns null when effective model is not a string', () => {
      const payload = {
        task: {
          id: 'task-1',
          name: 'Test',
          columnId: null,
          agentId: 'agent-1',
          agent: { id: 'agent-1', name: 'Claude', tag: AgentTag.ClaudeCode },
          model: null,
          useTaskAgentAndModel: true,
          bypass: false,
          projectId: 'proj-1',
          project: {
            id: 'proj-1',
            name: 'Test Project',
            status: 'ready' as const,
            defaultAgentId: 'agent-1',
            defaultAgent: { id: 'agent-1', name: 'Claude', tag: AgentTag.ClaudeCode },
            defaultModel: 'default-model',
            skills: [],
            createdAt: '2024-01-01T00:00:00Z',
            kanbanColumns: [],
          },
          column: null,
        },
      };

      expect(setupTerminalAgent(payload)).toBeNull();
    });

    it('returns null when agentFactory returns null', () => {
      const payload = {
        task: {
          id: 'task-1',
          name: 'Test',
          columnId: null,
          agentId: 'agent-unknown',
          agent: { id: 'agent-unknown', name: 'Unknown', tag: 'unknown' as AgentTag },
          model: 'unknown-model',
          useTaskAgentAndModel: true,
          bypass: false,
          projectId: 'proj-1',
          project: {
            id: 'proj-1',
            name: 'Test Project',
            status: 'ready' as const,
            defaultAgentId: 'agent-unknown',
            defaultAgent: { id: 'agent-unknown', name: 'Unknown', tag: 'unknown' as AgentTag },
            defaultModel: 'default-model',
            skills: [],
            createdAt: '2024-01-01T00:00:00Z',
            kanbanColumns: [],
          },
          column: null,
        },
      };

      expect(setupTerminalAgent(payload)).toBeNull();
    });
  });
});
