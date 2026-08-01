import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTag } from '@onezone/shared';
import type { ProjectInfo, TaskDetails } from '@onezone/shared';

const mockRunProcess = vi.fn();
const mockTerminateTree = vi.fn();

vi.mock('./process-runner.js', () => ({
  runProcess: (...args: unknown[]) => mockRunProcess(...args),
  terminateTree: (...args: unknown[]) => mockTerminateTree(...args),
}));

const mockGetProjectConfigFolder = vi.fn();
const mockGetAllInstalledSkills = vi.fn();
const mockRemoveSkill = vi.fn();
const mockSkillExistsReturn = new Map<string, boolean>();

vi.mock('./project-paths.js', () => ({
  getProjectConfigFolder: (...args: unknown[]) => mockGetProjectConfigFolder(...args),
  getAllInstalledSkills: (...args: unknown[]) => mockGetAllInstalledSkills(...args),
  removeSkill: (...args: unknown[]) => mockRemoveSkill(...args),
  getProjectFolder: vi.fn(),
  getProjectWorkDir: vi.fn(),
  createProjectFolder: vi.fn().mockReturnValue(true),
  createProjectConfigFolder: vi.fn().mockReturnValue(true),
  createProjectWorkDirFolder: vi.fn().mockReturnValue(true),
  ensureWorkDirProjectMarker: vi.fn().mockReturnValue(true),
  cloneProjectRepo: vi.fn().mockResolvedValue(true),
  setupClaudeConfig: vi.fn().mockReturnValue(true),
  setupCopilotConfig: vi.fn().mockReturnValue(true),
  setupOpencodeConfig: vi.fn().mockReturnValue(true),
}));

const mockGetEffectiveTaskAgentCode = vi.fn();

vi.mock('./effective-task-agent.js', () => ({
  getEffectiveTaskAgentCode: (...args: unknown[]) => mockGetEffectiveTaskAgentCode(...args),
  getEffectiveTaskAgentAndModel: vi.fn(),
}));

// Mock fs for skillExists checks inside skills.ts
const mockExistsSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
}));

import { runSkillCommand, setupSkills } from './skills.js';

describe('skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockSkillExistsReturn.clear();
  });

  const mockProject: ProjectInfo = {
    id: 'proj-1',
    name: 'Test Project',
    status: 'ready',
    defaultAgentId: 'agent-1',
    defaultAgent: { id: 'agent-1', name: 'Claude', tag: AgentTag.ClaudeCode },
    defaultModel: 'claude-model',
    skills: [
      { id: 'skill-1', source: 'https://github.com/test/skill-a', skillName: 'skill-a' },
      { id: 'skill-2', source: 'https://github.com/test/skill-b', skillName: 'skill-b' },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    kanbanColumns: [],
  };

  const mockTask: TaskDetails = {
    id: 'task-1',
    name: 'Test Task',
    columnId: null,
    agentId: 'agent-1',
    agent: { id: 'agent-1', name: 'Claude', tag: AgentTag.ClaudeCode },
    model: 'claude-model',
    useTaskAgentAndModel: true,
    bypass: false,
    projectId: 'proj-1',
    project: mockProject,
    column: null,
  };

  describe('runSkillCommand', () => {
    it('does nothing when skill already exists', async () => {
      mockExistsSync.mockReturnValue(true);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      const log = vi.fn();
      await runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log,
      );
      expect(log).not.toHaveBeenCalled();
      expect(mockRunProcess).not.toHaveBeenCalled();
    });

    it('aborts immediately when signal is already aborted', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      const log = vi.fn();
      const abortController = new AbortController();
      abortController.abort();
      await runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log,
        abortController.signal,
      );
      expect(mockRunProcess).not.toHaveBeenCalled();
    });

    it('installs skill when missing', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      const eventHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};
      mockRunProcess.mockImplementation(({ onExit }) => {
        const mockProc = {
          pid: 123,
          once: (event: string, handler: (...args: unknown[]) => void) => {
            if (!eventHandlers[event]) eventHandlers[event] = [];
            eventHandlers[event].push(handler);
          },
        };
        setTimeout(() => {
          onExit?.(0);
          eventHandlers['close']?.forEach((h) => h());
        }, 10);
        return mockProc;
      });

      const log = vi.fn();
      await runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log,
      );
      expect(log).toHaveBeenCalledWith(expect.stringContaining('Installing'));
      expect(log).toHaveBeenCalledWith(expect.stringContaining('completed'));
    });

    it('dedupes concurrent installs for same skill', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => {
          onExit?.(0);
          resolveFirst();
        }, 50);
        return { pid: 123 };
      });

      const log1 = vi.fn();
      const log2 = vi.fn();

      const promise1 = runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log1,
      );
      const promise2 = runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log2,
      );

      await Promise.all([promise1, promise2]);
      // Only one process should have been spawned
      expect(mockRunProcess).toHaveBeenCalledTimes(1);
    });

    it('deduped install with aborted signal resolves immediately', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => {
          onExit?.(0);
          resolveFirst();
        }, 50);
        return { pid: 123 };
      });

      const log1 = vi.fn();
      const log2 = vi.fn();

      const abortController = new AbortController();
      abortController.abort();

      const promise1 = runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log1,
      );
      const promise2 = runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log2,
        abortController.signal,
      );

      await Promise.all([promise1, promise2]);
      expect(mockRunProcess).toHaveBeenCalledTimes(1);
      expect(log2).not.toHaveBeenCalledWith(expect.stringContaining('completed'));
    });

    it('deduped install resolves when signal aborts mid-wait', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      let resolveFirst: () => void;
      const firstPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => {
          onExit?.(0);
          resolveFirst();
        }, 200);
        return { pid: 123 };
      });

      const log1 = vi.fn();
      const log2 = vi.fn();

      const abortController = new AbortController();

      const promise1 = runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log1,
      );
      const promise2 = runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log2,
        abortController.signal,
      );

      // Abort while the first install is still pending
      setTimeout(() => abortController.abort(), 10);

      await Promise.all([promise1, promise2]);
      expect(mockRunProcess).toHaveBeenCalledTimes(1);
    });

    it('terminates process when signal aborts mid-run', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      const abortController = new AbortController();

      let closeHandler: (() => void) | undefined;
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => {
          onExit?.(0);
          closeHandler?.();
        }, 100);
        return {
          pid: 123,
          once: (event: string, handler: () => void) => {
            if (event === 'close') closeHandler = handler;
          },
        };
      });

      const log = vi.fn();
      const promise = runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log,
        abortController.signal,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));
      abortController.abort();

      await promise;

      expect(mockTerminateTree).toHaveBeenCalledWith(123);
    });

    it('installs skill for github-copilot-cli agent', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => {
          onExit?.(0);
          handlers['close']?.forEach((h) => h());
        }, 0);
        return {
          pid: 123,
          once: (event: string, handler: (...args: unknown[]) => void) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
          },
        };
      });

      const log = vi.fn();
      await runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.GithubCopilotCLI,
        },
        log,
      );
      expect(log).toHaveBeenCalledWith(expect.stringContaining('completed'));
    });

    it('installs skill for opencode agent', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => {
          onExit?.(0);
          handlers['close']?.forEach((h) => h());
        }, 0);
        return {
          pid: 123,
          once: (event: string, handler: (...args: unknown[]) => void) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
          },
        };
      });

      const log = vi.fn();
      await runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.Opencode,
        },
        log,
      );
      expect(log).toHaveBeenCalledWith(expect.stringContaining('completed'));
    });

    it('logs exit code when command fails', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => {
          onExit?.(1);
          handlers['close']?.forEach((h) => h());
        }, 0);
        return {
          pid: 123,
          once: (event: string, handler: (...args: unknown[]) => void) => {
            if (!handlers[event]) handlers[event] = [];
            handlers[event].push(handler);
          },
        };
      });

      const log = vi.fn();
      await runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log,
      );
      expect(log).toHaveBeenCalledWith(expect.stringContaining('exited with code 1'));
    });

    it('logs error when runProcess throws', async () => {
      mockExistsSync.mockReturnValue(false);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      mockRunProcess.mockImplementation(() => {
        throw new Error('spawn failed');
      });

      const log = vi.fn();
      await runSkillCommand(
        {
          projectId: 'proj-1',
          source: 'https://github.com/test/skill-a',
          skillName: 'skill-a',
          agentCode: AgentTag.ClaudeCode,
        },
        log,
      );
      expect(log).toHaveBeenCalledWith(expect.stringContaining('failed: spawn failed'));
    });
  });

  describe('setupSkills', () => {
    it('installs uninstalled skills', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      mockGetAllInstalledSkills.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);
      mockRunProcess.mockImplementation(({ onExit }) => {
        setTimeout(() => onExit?.(0), 0);
        return { pid: 123 };
      });

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit });

      expect(emit).toHaveBeenCalledWith('Installing 2 skill(s)...');
      expect(emit).toHaveBeenCalledWith('\u2714 Skills ready.');
    });

    it('removes extra skills not in project config', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      mockGetAllInstalledSkills.mockReturnValue(['unwanted-skill']);
      mockRemoveSkill.mockReturnValue(true);
      mockExistsSync.mockReturnValue(true);

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit });

      expect(mockRemoveSkill).toHaveBeenCalledWith('proj-1', 'unwanted-skill', AgentTag.ClaudeCode);
    });

    it('skips when no agent is configured', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(null);

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit });

      expect(emit).toHaveBeenCalledWith('Skipping skill install: no agent configured.');
      expect(mockRunProcess).not.toHaveBeenCalled();
    });

    it('respects abort signal', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);

      const abortController = new AbortController();
      abortController.abort();

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit, signal: abortController.signal });

      expect(mockRunProcess).not.toHaveBeenCalled();
    });

    it('does nothing when all skills are already installed', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      mockGetAllInstalledSkills.mockReturnValue(['skill-a', 'skill-b']);
      mockExistsSync.mockReturnValue(true);

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit });

      expect(emit).not.toHaveBeenCalledWith('Installing 0 skill(s)...');
      expect(mockRunProcess).not.toHaveBeenCalled();
    });

    it('keeps onezone-prefixed skills even if not in config', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      mockGetAllInstalledSkills.mockReturnValue(['onezone-runner']);
      mockExistsSync.mockReturnValue(true);

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit });

      expect(mockRemoveSkill).not.toHaveBeenCalled();
    });

    it('aborts skill install mid-loop when signal aborts', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      mockGetAllInstalledSkills.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);

      const abortController = new AbortController();
      mockRunProcess.mockImplementation(() => {
        abortController.abort();
        return { pid: 123 };
      });

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit, signal: abortController.signal });
      expect(emit).toHaveBeenCalledWith('Installing 2 skill(s)...');
    });

    it('aborts after skill install loop when signal aborts', async () => {
      mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
      mockGetProjectConfigFolder.mockReturnValue('/test/home/.onezone/projects/proj-1/config');
      mockGetAllInstalledSkills.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);

      let callCount = 0;
      const abortController = new AbortController();
      mockRunProcess.mockImplementation(({ onExit }) => {
        callCount++;
        if (callCount >= 2) {
          abortController.abort();
        }
        setTimeout(() => onExit?.(0), 0);
        return { pid: 123 };
      });

      const emit = vi.fn();
      await setupSkills({ task: mockTask, project: mockProject, emit, signal: abortController.signal });
      expect(emit).not.toHaveBeenCalledWith('\u2714 Skills ready.');
    });
  });
});
