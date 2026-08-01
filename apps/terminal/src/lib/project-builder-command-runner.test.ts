import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentTag } from '@onezone/shared';

const mockCreateProjectConfigFolder = vi.fn();
const mockCreateProjectFolder = vi.fn();
const mockCreateProjectWorkDirFolder = vi.fn();
const mockEnsureWorkDirProjectMarker = vi.fn();
const mockGetProjectWorkDir = vi.fn();
const mockSetupClaudeConfig = vi.fn();
const mockSetupCopilotConfig = vi.fn();
const mockSetupOpencodeConfig = vi.fn();
const mockAgentFactory = vi.fn();

vi.doMock('./project-paths.js', () => ({
  createProjectConfigFolder: mockCreateProjectConfigFolder,
  createProjectFolder: mockCreateProjectFolder,
  createProjectWorkDirFolder: mockCreateProjectWorkDirFolder,
  ensureWorkDirProjectMarker: mockEnsureWorkDirProjectMarker,
  getProjectWorkDir: mockGetProjectWorkDir,
  setupClaudeConfig: mockSetupClaudeConfig,
  setupCopilotConfig: mockSetupCopilotConfig,
  setupOpencodeConfig: mockSetupOpencodeConfig,
}));

vi.doMock('../agents/setup.js', () => ({
  agentFactory: mockAgentFactory,
}));

describe('runProjectBuilderCommand', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreateProjectFolder.mockReturnValue(true);
    mockCreateProjectConfigFolder.mockReturnValue(true);
    mockCreateProjectWorkDirFolder.mockReturnValue(true);
    mockSetupClaudeConfig.mockReturnValue(true);
    mockSetupCopilotConfig.mockReturnValue(true);
    mockSetupOpencodeConfig.mockReturnValue(true);
    mockGetProjectWorkDir.mockReturnValue('/test/workdir');
  });

  it('returns early when terminalId does not match', async () => {
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await runProjectBuilderCommand(
      { terminalId: 'other', projectId: 'p1', projectName: 'Proj', boardPrompt: 'hello', commandId: 'cmd-1', agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' }, model: 'claude-3' },
      { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log },
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('throws when workspace setup fails', async () => {
    mockCreateProjectFolder.mockReturnValue(false);
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await expect(
      runProjectBuilderCommand(
        { terminalId: 'term-1', projectId: 'p1', projectName: 'Proj', boardPrompt: 'hello', commandId: 'cmd-1', agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' }, model: 'claude-3' },
        { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log },
      ),
    ).rejects.toThrow('Failed to prepare project builder workspace');
  });

  it('throws when no terminal agent configured', async () => {
    mockAgentFactory.mockReturnValue(null);
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await expect(
      runProjectBuilderCommand(
        { terminalId: 'term-1', projectId: 'p1', projectName: 'Proj', boardPrompt: 'hello', commandId: 'cmd-1', agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' }, model: 'claude-3' },
        { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log },
      ),
    ).rejects.toThrow('No terminal agent configured');
  });

  it('sets up copilot config for copilot agent', async () => {
    const mockRun = (async function* () { yield { type: 'text', content: 'done' }; })();
    mockAgentFactory.mockReturnValue({ run: () => mockRun });
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await runProjectBuilderCommand(
      { terminalId: 'term-1', projectId: 'p1', projectName: 'Proj', boardPrompt: 'hello', commandId: 'cmd-1', agent: { tag: AgentTag.GithubCopilotCLI, id: 'a1', name: 'Copilot' }, model: 'gpt-4' },
      { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log },
    );
    expect(mockSetupCopilotConfig).toHaveBeenCalled();
  });

  it('sets up opencode config for opencode agent', async () => {
    const mockRun = (async function* () { yield { type: 'text', content: 'done' }; })();
    mockAgentFactory.mockReturnValue({ run: () => mockRun });
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await runProjectBuilderCommand(
      { terminalId: 'term-1', projectId: 'p1', projectName: 'Proj', boardPrompt: 'hello', commandId: 'cmd-1', agent: { tag: AgentTag.Opencode, id: 'a1', name: 'Opencode' }, model: 'gpt-4' },
      { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log },
    );
    expect(mockSetupOpencodeConfig).toHaveBeenCalled();
  });

  it('logs message at start and finish', async () => {
    const mockRun = (async function* () { yield { type: 'text', content: 'done' }; })();
    mockAgentFactory.mockReturnValue({ run: () => mockRun });
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await runProjectBuilderCommand(
      { terminalId: 'term-1', projectId: 'p1', projectName: 'Proj', boardPrompt: 'hello', commandId: 'cmd-1', agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' }, model: 'claude-3' },
      { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log },
    );
    expect(log).toHaveBeenCalledWith('[Test] Running project builder command cmd-1');
    expect(log).toHaveBeenCalledWith('[Test] Project builder command cmd-1 finished');
  });

  it('logs stop message when aborted', async () => {
    const controller = new AbortController();
    const mockRun = (async function* () {
      controller.abort();
      yield { type: 'text', content: 'done' };
    })();
    mockAgentFactory.mockReturnValue({ run: () => mockRun });
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await runProjectBuilderCommand(
      { terminalId: 'term-1', projectId: 'p1', projectName: 'Proj', boardPrompt: 'hello', commandId: 'cmd-1', agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' }, model: 'claude-3' },
      { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log, signal: controller.signal },
    );
    expect(log).toHaveBeenCalledWith('[Test] Project builder command cmd-1 stopped');
  });

  it('builds prompt with optional description and repository', async () => {
    const collected: Array<Record<string, unknown>> = [];
    const mockRun = (async function* () {
      yield { type: 'text', content: 'done' };
    })();
    mockAgentFactory.mockReturnValue({ run: (opts: { prompt: string }) => { collected.push({ prompt: opts.prompt }); return mockRun; } });
    const { runProjectBuilderCommand } = await import('./project-builder-command-runner.js');
    const log = vi.fn();
    await runProjectBuilderCommand(
      {
        terminalId: 'term-1',
        projectId: 'p1',
        projectName: 'My Proj',
        projectDescription: 'A test project',
        repository: 'https://github.com/user/repo',
        boardPrompt: 'Create a board',
        commandId: 'cmd-1',
        agent: { tag: AgentTag.ClaudeCode, id: 'a1', name: 'Claude' },
        model: 'claude-3',
      },
      { serverUrl: 'http://localhost:3000', terminalId: 'term-1', terminalName: 'Test', log },
    );
    const prompt = collected[0].prompt as string;
    expect(prompt).toContain('My Proj');
    expect(prompt).toContain('A test project');
    expect(prompt).toContain('https://github.com/user/repo');
    expect(prompt).toContain('Create a board');
  });
});
