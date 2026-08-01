import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTag } from '@onezone/shared';
import type { TaskDetails } from '@onezone/shared';

const mockSetupClaude = vi.fn();
const mockSetupCopilot = vi.fn();
const mockSetupOpencode = vi.fn();

vi.mock('../agents/claude.js', () => ({
  setup: (...args: unknown[]) => mockSetupClaude(...args),
}));

vi.mock('../agents/copilot.js', () => ({
  setup: (...args: unknown[]) => mockSetupCopilot(...args),
}));

vi.mock('../agents/opencode.js', () => ({
  setup: (...args: unknown[]) => mockSetupOpencode(...args),
}));

import { agentFactory, setupTerminalAgent } from './setup.js';

describe('agents/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('agentFactory', () => {
    it('returns Claude config for AgentTag.ClaudeCode', () => {
      mockSetupClaude.mockReturnValue({ tag: AgentTag.ClaudeCode, run: vi.fn() });
      const result = agentFactory({
        projectId: 'proj-1',
        agent: { id: 'agent-1', name: 'Claude', tag: AgentTag.ClaudeCode },
        model: 'claude-model',
      });
      expect(result).toBeDefined();
      expect(mockSetupClaude).toHaveBeenCalledWith({ projectId: 'proj-1', model: 'claude-model' });
    });

    it('returns Copilot config for AgentTag.GithubCopilotCLI', () => {
      mockSetupCopilot.mockReturnValue({ tag: AgentTag.GithubCopilotCLI, run: vi.fn() });
      const result = agentFactory({
        projectId: 'proj-1',
        agent: { id: 'agent-2', name: 'Copilot', tag: AgentTag.GithubCopilotCLI },
        model: 'copilot-model',
      });
      expect(result).toBeDefined();
      expect(mockSetupCopilot).toHaveBeenCalledWith({ projectId: 'proj-1', model: 'copilot-model' });
    });

    it('returns Opencode config for AgentTag.Opencode', () => {
      mockSetupOpencode.mockReturnValue({ tag: AgentTag.Opencode, run: vi.fn() });
      const result = agentFactory({
        projectId: 'proj-1',
        agent: { id: 'agent-3', name: 'Opencode', tag: AgentTag.Opencode },
        model: 'opencode-model',
      });
      expect(result).toBeDefined();
      expect(mockSetupOpencode).toHaveBeenCalledWith({ projectId: 'proj-1', model: 'opencode-model' });
    });

    it('returns null when agent is null', () => {
      const result = agentFactory({
        projectId: 'proj-1',
        agent: null,
        model: 'any-model',
      });
      expect(result).toBeNull();
    });

    it('returns null for unknown agent tag', () => {
      const result = agentFactory({
        projectId: 'proj-1',
        agent: { id: 'agent-4', name: 'Unknown', tag: 'unknown-tag' as AgentTag },
        model: 'unknown-model',
      });
      expect(result).toBeNull();
    });
  });

  describe('setupTerminalAgent', () => {
    it('returns config for valid task payload', () => {
      mockSetupClaude.mockReturnValue({ tag: AgentTag.ClaudeCode, run: vi.fn() });
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
        } satisfies TaskDetails,
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
      mockSetupClaude.mockReturnValue({ tag: AgentTag.ClaudeCode, run: vi.fn() });
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

      // Force agentFactory to return null by returning null from setupClaude
      mockSetupClaude.mockReturnValue(null);
      expect(setupTerminalAgent(payload)).toBeNull();
    });
  });
});
