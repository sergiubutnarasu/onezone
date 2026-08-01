import { describe, it, expect } from 'vitest';
import { AgentTag } from '@onezone/shared';
import type { TaskDetails, ProjectInfo } from '@onezone/shared';
import {
  getEffectiveTaskAgentAndModel,
  getEffectiveTaskAgentCode,
} from './effective-task-agent.js';

const mockAgent = {
  id: 'agent-1',
  name: 'Claude',
  tag: AgentTag.ClaudeCode,
};

const mockColumnAgent = {
  id: 'agent-2',
  name: 'Copilot',
  tag: AgentTag.GithubCopilotCLI,
};

const mockProject: ProjectInfo = {
  id: 'proj-1',
  name: 'Test Project',
  status: 'ready',
  defaultAgentId: 'agent-default',
  defaultAgent: { id: 'agent-default', name: 'Default', tag: AgentTag.Opencode },
  defaultModel: 'default-model',
  skills: [],
  createdAt: '2024-01-01T00:00:00Z',
  kanbanColumns: [],
};

describe('getEffectiveTaskAgentAndModel', () => {
  it('uses task-level agent when useTaskAgentAndModel is true', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: null,
      agentId: 'agent-1',
      agent: mockAgent,
      model: 'task-model',
      useTaskAgentAndModel: true,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: null,
    };

    const result = getEffectiveTaskAgentAndModel(task, mockProject);

    expect(result.agent).toEqual(mockAgent);
    expect(result.model).toBe('task-model');
  });

  it('uses column-level agent when useTaskAgentAndModel is false and column has agent', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: 'col-1',
      agentId: 'agent-1',
      agent: mockAgent,
      model: 'task-model',
      useTaskAgentAndModel: false,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: {
        id: 'col-1',
        projectId: 'proj-1',
        name: 'In Progress',
        instructions: '',
        index: 0,
        agentId: 'agent-2',
        agent: mockColumnAgent,
        model: 'column-model',
        createdAt: '2024-01-01T00:00:00Z',
      },
    };

    const result = getEffectiveTaskAgentAndModel(task, mockProject);

    expect(result.agent).toEqual(mockColumnAgent);
    expect(result.model).toBe('column-model');
  });

  it('falls back to task model when column has no model', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: 'col-1',
      agentId: 'agent-1',
      agent: mockAgent,
      model: 'task-model',
      useTaskAgentAndModel: false,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: {
        id: 'col-1',
        projectId: 'proj-1',
        name: 'In Progress',
        instructions: '',
        index: 0,
        agentId: 'agent-2',
        agent: mockColumnAgent,
        model: null,
        createdAt: '2024-01-01T00:00:00Z',
      },
    };

    const result = getEffectiveTaskAgentAndModel(task, mockProject);

    expect(result.agent).toEqual(mockColumnAgent);
    expect(result.model).toBe('task-model');
  });

  it('falls back to project default when task has no agent', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: null,
      agentId: 'agent-1',
      agent: null,
      model: 'task-model',
      useTaskAgentAndModel: true,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: null,
    };

    const result = getEffectiveTaskAgentAndModel(task, mockProject);

    expect(result.agent).toEqual(mockProject.defaultAgent);
    // When task.agent is null, model falls to project default
    expect(result.model).toBe('default-model');
  });

  it('falls back to project default model when no task model', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: null,
      agentId: 'agent-1',
      agent: mockAgent,
      model: null as unknown as string,
      useTaskAgentAndModel: true,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: null,
    };

    const result = getEffectiveTaskAgentAndModel(task, mockProject);

    expect(result.agent).toEqual(mockAgent);
    expect(result.model).toBe('default-model');
  });

  it('falls back to project default model when column and task have no model', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: 'col-1',
      agentId: 'agent-1',
      agent: mockAgent,
      model: null as unknown as string,
      useTaskAgentAndModel: false,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: {
        id: 'col-1',
        projectId: 'proj-1',
        name: 'In Progress',
        instructions: '',
        index: 0,
        agentId: 'agent-2',
        agent: mockColumnAgent,
        model: null as unknown as string,
        createdAt: '2024-01-01T00:00:00Z',
      },
    };

    const result = getEffectiveTaskAgentAndModel(task, mockProject);

    expect(result.agent).toEqual(mockColumnAgent);
    expect(result.model).toBe('default-model');
  });

  it('falls back to null when no project provided and column/task have no model', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: 'col-1',
      agentId: 'agent-1',
      agent: mockAgent,
      model: null as unknown as string,
      useTaskAgentAndModel: false,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: {
        id: 'col-1',
        projectId: 'proj-1',
        name: 'In Progress',
        instructions: '',
        index: 0,
        agentId: 'agent-2',
        agent: mockColumnAgent,
        model: null as unknown as string,
        createdAt: '2024-01-01T00:00:00Z',
      },
    };

    const result = getEffectiveTaskAgentAndModel(task, undefined);

    expect(result.agent).toEqual(mockColumnAgent);
    expect(result.model).toBeNull();
  });

  it('returns nulls when no task and no project defaults', () => {
    const result = getEffectiveTaskAgentAndModel(undefined, {
      ...mockProject,
      defaultAgent: null,
      defaultModel: null as unknown as string,
    });

    expect(result.agent).toBeNull();
    expect(result.model).toBeNull();
  });
});

describe('getEffectiveTaskAgentCode', () => {
  it('returns agent tag when task has agent', () => {
    const task: TaskDetails = {
      id: 'task-1',
      name: 'Test Task',
      columnId: null,
      agentId: 'agent-1',
      agent: mockAgent,
      model: 'task-model',
      useTaskAgentAndModel: true,
      bypass: false,
      projectId: 'proj-1',
      project: mockProject,
      column: null,
    };

    expect(getEffectiveTaskAgentCode(task, mockProject)).toBe(AgentTag.ClaudeCode);
  });

it('returns project default agent tag when task has no agent', () => {
      const task: TaskDetails = {
        id: 'task-1',
        name: 'Test Task',
        columnId: null,
        agentId: 'agent-1',
        agent: null,
        model: 'task-model',
        useTaskAgentAndModel: true,
        bypass: false,
        projectId: 'proj-1',
        project: mockProject,
        column: null,
      };

      expect(getEffectiveTaskAgentCode(task, mockProject)).toBe(AgentTag.Opencode);
    });

  it('returns null when no task and project has no default agent', () => {
    const projectNoAgent: ProjectInfo = {
      ...mockProject,
      defaultAgent: null,
    };

    expect(getEffectiveTaskAgentCode(undefined, projectNoAgent)).toBeNull();
  });
});
