import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTag } from '@onezone/shared';

const mockCreateProjectFolder = vi.fn();
const mockCreateProjectConfigFolder = vi.fn();
const mockCreateProjectWorkDirFolder = vi.fn();
const mockEnsureWorkDirProjectMarker = vi.fn();
const mockCloneProjectRepo = vi.fn();
const mockSetupClaudeConfig = vi.fn();
const mockSetupCopilotConfig = vi.fn();
const mockSetupOpencodeConfig = vi.fn();
const mockGetProjectFolder = vi.fn();
const mockGetProjectWorkDir = vi.fn();
const mockGetEffectiveTaskAgentCode = vi.fn();
const mockSetupSkills = vi.fn();

vi.doMock('./project-paths.js', () => ({
  createProjectFolder: mockCreateProjectFolder,
  createProjectConfigFolder: mockCreateProjectConfigFolder,
  createProjectWorkDirFolder: mockCreateProjectWorkDirFolder,
  ensureWorkDirProjectMarker: mockEnsureWorkDirProjectMarker,
  cloneProjectRepo: mockCloneProjectRepo,
  setupClaudeConfig: mockSetupClaudeConfig,
  setupCopilotConfig: mockSetupCopilotConfig,
  setupOpencodeConfig: mockSetupOpencodeConfig,
  getProjectFolder: mockGetProjectFolder,
  getProjectWorkDir: mockGetProjectWorkDir,
}));

vi.doMock('./effective-task-agent.js', () => ({
  getEffectiveTaskAgentCode: mockGetEffectiveTaskAgentCode,
}));

vi.doMock('./skills.js', () => ({
  setupSkills: mockSetupSkills,
}));

describe('setupProject', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreateProjectFolder.mockReturnValue(true);
    mockCreateProjectConfigFolder.mockReturnValue(true);
    mockCreateProjectWorkDirFolder.mockReturnValue(true);
    mockCloneProjectRepo.mockResolvedValue(true);
    mockSetupClaudeConfig.mockReturnValue(true);
    mockSetupCopilotConfig.mockReturnValue(true);
    mockSetupOpencodeConfig.mockReturnValue(true);
    mockGetProjectFolder.mockReturnValue('/test/projects/proj-123');
    mockGetProjectWorkDir.mockReturnValue('/test/projects/proj-123/workdir');
    mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
    mockSetupSkills.mockResolvedValue(undefined);
  });

  it('returns null when signal is aborted', async () => {
    const { setupProject } = await import('./setup.js');
    const signal = new AbortController().signal;
    vi.spyOn(signal, 'aborted', 'get').mockReturnValue(true);
    const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, undefined, signal);
    expect(result).toBeNull();
  });

  it('returns null when payload is not an object', async () => {
    const { setupProject } = await import('./setup.js');
    const result = await setupProject(null);
    expect(result).toBeNull();
  });

  it('returns null when payload has no task', async () => {
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ other: true });
    expect(result).toBeNull();
  });

  it('returns null when task is not an object', async () => {
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: 'string' });
    expect(result).toBeNull();
  });

  it('returns null when task.project is not an object', async () => {
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { id: 'task-1', project: null } });
    expect(result).toBeNull();
  });

  it('returns null when project has no id', async () => {
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { id: 'task-1', project: {} } });
    expect(result).toBeNull();
  });

  it('returns null when task id is missing', async () => {
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { project: { id: '123' } } });
    expect(result).toBeNull();
  });

  it('returns null when project folder creation fails', async () => {
    mockCreateProjectFolder.mockReturnValue(false);
    const { setupProject } = await import('./setup.js');
    const emit = vi.fn();
    const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, emit);
    expect(result).toBeNull();
    expect(emit).toHaveBeenCalledWith(expect.stringContaining('Failed to create project folder'));
  });

  it('returns null when config folder creation fails', async () => {
    mockCreateProjectConfigFolder.mockReturnValue(false);
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, vi.fn());
    expect(result).toBeNull();
  });

  it('returns null when workdir folder creation fails', async () => {
    mockCreateProjectWorkDirFolder.mockReturnValue(false);
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, vi.fn());
    expect(result).toBeNull();
  });

  it('returns null when clone fails', async () => {
    mockCloneProjectRepo.mockResolvedValue(false);
    const { setupProject } = await import('./setup.js');
    const result = await setupProject(
      { task: { project: { id: '123', repository: 'https://github.com/user/repo' }, id: 'task-1' } },
      vi.fn(),
    );
    expect(result).toBeNull();
  });

  it('returns null when clone aborted', async () => {
    const signal = new AbortController().signal;
    vi.spyOn(signal, 'aborted', 'get').mockReturnValue(true);
    mockCloneProjectRepo.mockResolvedValue(false);
    const { setupProject } = await import('./setup.js');
    const result = await setupProject(
      { task: { project: { id: '123', repository: 'https://github.com/user/repo' }, id: 'task-1' } },
      vi.fn(),
      signal,
    );
    expect(result).toBeNull();
  });

  it('calls ensureWorkDirProjectMarker when no repository', async () => {
    const { setupProject } = await import('./setup.js');
    await setupProject({ task: { project: { id: '123' }, id: 'task-1' } });
    expect(mockEnsureWorkDirProjectMarker).toHaveBeenCalledWith('123');
  });

  it('does not call ensureWorkDirProjectMarker when repository exists', async () => {
    const { setupProject } = await import('./setup.js');
    await setupProject(
      { task: { project: { id: '123', repository: 'https://github.com/user/repo' }, id: 'task-1' } },
      vi.fn(),
    );
    expect(mockEnsureWorkDirProjectMarker).not.toHaveBeenCalled();
  });

  it('sets up Copilot config for copilot agent', async () => {
    mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.GithubCopilotCLI);
    const { setupProject } = await import('./setup.js');
    await setupProject({ task: { project: { id: '123' }, id: 'task-1' } });
    expect(mockSetupCopilotConfig).toHaveBeenCalledWith('123');
  });

  it('sets up Opencode config for opencode agent', async () => {
    mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.Opencode);
    const { setupProject } = await import('./setup.js');
    await setupProject({ task: { project: { id: '123' }, id: 'task-1' } });
    expect(mockSetupOpencodeConfig).toHaveBeenCalledWith('123');
  });

  it('sets up Claude config by default', async () => {
    mockGetEffectiveTaskAgentCode.mockReturnValue(AgentTag.ClaudeCode);
    const { setupProject } = await import('./setup.js');
    await setupProject({ task: { project: { id: '123' }, id: 'task-1' } });
    expect(mockSetupClaudeConfig).toHaveBeenCalledWith('123');
  });

  it('returns TaskJobConfig on success', async () => {
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } });
    expect(result).toEqual({
      projectId: '123',
      taskId: 'task-1',
      projectFolder: '/test/projects/proj-123',
      projectWorkDir: '/test/projects/proj-123/workdir',
    });
  });

  it('emits setup messages through callback', async () => {
    const emit = vi.fn();
    const { setupProject } = await import('./setup.js');
    await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, emit);
    expect(emit).toHaveBeenCalledWith(expect.stringContaining('Project folder ready'));
    expect(emit).toHaveBeenCalledWith(expect.stringContaining('Config folder ready'));
    expect(emit).toHaveBeenCalledWith(expect.stringContaining('Workdir ready'));
  });

  it('returns null when aborted during skill setup', async () => {
    const signal = new AbortController().signal;
    vi.spyOn(signal, 'aborted', 'get').mockReturnValue(true);
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, vi.fn(), signal);
    expect(result).toBeNull();
  });

  it('returns null when aborted after skill setup', async () => {
    const signal = new AbortController();
    mockSetupSkills.mockImplementation(async () => {
      signal.abort();
    });
    const { setupProject } = await import('./setup.js');
    const result = await setupProject({ task: { project: { id: '123' }, id: 'task-1' } }, vi.fn(), signal.signal);
    expect(result).toBeNull();
  });
});
