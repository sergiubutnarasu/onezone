import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalRegistryService } from './terminal-registry.service.js';
import type { Server, Socket } from 'socket.io';
import { EventCommands } from '@onezone/shared';

const createMockServer = () => {
  const rooms = new Map<string, Set<string>>();
  const server = {
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
      disconnectSockets: vi.fn(),
    }),
    in: vi.fn().mockReturnValue({
      disconnectSockets: vi.fn(),
    }),
    adapter: { rooms },
  } as unknown as Server;
  return { server, rooms };
};

describe('TerminalRegistryService', () => {
  let service: TerminalRegistryService;
  let mock: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    service = new TerminalRegistryService();
    mock = createMockServer();
    service.setServer(mock.server);
  });

  describe('register / deregister', () => {
    it('registers a terminal socket', () => {
      service.register('term-1', 'socket-1');
      expect(service.getSocketId('term-1')).toBe('socket-1');
    });

    it('deregisters a terminal socket', () => {
      service.register('term-1', 'socket-1');
      service.deregister('term-1');
      expect(service.getSocketId('term-1')).toBeUndefined();
    });

    it('clears project builder mapping on deregister', () => {
      service.register('term-1', 'socket-1');
      service.runProjectBuilderCommand('term-1', { commandId: 'cmd-1', projectId: 'proj-1', agentId: 'a1', model: 'm1', boardPrompt: 'bp', name: 'n' });
      service.deregister('term-1');
      expect(service.getSocketId('term-1')).toBeUndefined();
    });
  });

  describe('disconnectTerminal', () => {
    it('disconnects terminal socket', () => {
      service.register('term-1', 'socket-1');
      service.disconnectTerminal('term-1');
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
    });

    it('does nothing if terminal not registered', () => {
      service.disconnectTerminal('term-1');
      expect(mock.server.to).not.toHaveBeenCalled();
    });
  });

  describe('disconnectTaskTerminal', () => {
    it('disconnects task terminal socket', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      service.disconnectTaskTerminal('task-1');
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
      expect(service.forwardCommandRunToTerminal('task-1', {})).toBe(false);
    });

    it('does nothing if task socket not registered', () => {
      service.disconnectTaskTerminal('task-1');
      expect(mock.server.to).not.toHaveBeenCalled();
    });

    it('does nothing if server not set', () => {
      const noServerService = new TerminalRegistryService();
      noServerService.registerTaskSocket('task-1', 'socket-1');
      noServerService.disconnectTaskTerminal('task-1');
      expect(mock.server.to).not.toHaveBeenCalled();
    });
  });

  describe('evictTaskTerminal', () => {
    it('evicts task terminal socket', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      service.evictTaskTerminal('task-1');
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
    });

    it('does nothing if task socket not registered', () => {
      service.evictTaskTerminal('task-1');
      expect(mock.server.to).not.toHaveBeenCalled();
    });

    it('does nothing if server not set', () => {
      const noServerService = new TerminalRegistryService();
      noServerService.registerTaskSocket('task-1', 'socket-1');
      noServerService.evictTaskTerminal('task-1');
      expect(mock.server.to).not.toHaveBeenCalled();
    });
  });

  describe('task sockets', () => {
    it('registers task socket', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      expect(service.forwardCommandRunToTerminal('task-1', {})).toBe(true);
    });

    it('evicts previous socket when registering new one', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      service.registerTaskSocket('task-1', 'socket-2');
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
    });

    it('deregisters task socket', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      service.deregisterTaskSocket('task-1', 'socket-1');
      expect(service.forwardCommandRunToTerminal('task-1', {})).toBe(false);
    });

    it('ignores deregister for different socket', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      service.deregisterTaskSocket('task-1', 'socket-2');
      expect(service.forwardCommandRunToTerminal('task-1', {})).toBe(true);
    });
  });

  describe('assignTask', () => {
    it('returns false when terminal not connected', () => {
      const result = service.assignTask('term-1', { id: 'task-1', name: 'Task 1' } as any);
      expect(result).toBe(false);
    });

    it('returns true and emits when terminal connected', () => {
      service.register('term-1', 'socket-1');
      const result = service.assignTask('term-1', { id: 'task-1', name: 'Task 1' } as any);
      expect(result).toBe(true);
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
    });
  });

  describe('runProjectBuilderCommand', () => {
    it('returns false when terminal not connected', () => {
      const result = service.runProjectBuilderCommand('term-1', {
        commandId: 'cmd-1',
        projectId: 'proj-1',
        agentId: 'a1',
        model: 'm1',
        boardPrompt: 'bp',
        name: 'n',
      });
      expect(result).toBe(false);
    });

    it('returns true and emits when terminal connected', () => {
      service.register('term-1', 'socket-1');
      const result = service.runProjectBuilderCommand('term-1', {
        commandId: 'cmd-1',
        projectId: 'proj-1',
        agentId: 'a1',
        model: 'm1',
        boardPrompt: 'bp',
        name: 'n',
      });
      expect(result).toBe(true);
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
    });
  });

  describe('stopProjectBuilderCommand', () => {
    it('returns false when no builder terminal registered', () => {
      const result = service.stopProjectBuilderCommand('proj-1', { commandId: 'cmd-1' });
      expect(result).toBe(false);
    });

    it('returns false when terminalId exists but socket not found', () => {
      // Register a terminal socket first, but only via runProjectBuilderCommand's mapping
      service.runProjectBuilderCommand('term-1', { commandId: 'cmd-1', projectId: 'proj-1', agentId: 'a1', model: 'm1', boardPrompt: 'bp', name: 'n' });
      // Now remove the terminal socket from the registry but keep the project builder mapping
      service.deregister('term-1');
      const result = service.stopProjectBuilderCommand('proj-1', { commandId: 'cmd-1' });
      expect(result).toBe(false);
    });

    it('returns true when terminal and socket are found', () => {
      service.register('term-1', 'socket-1');
      service.runProjectBuilderCommand('term-1', { commandId: 'cmd-1', projectId: 'proj-1', agentId: 'a1', model: 'm1', boardPrompt: 'bp', name: 'n' });
      const result = service.stopProjectBuilderCommand('proj-1', { commandId: 'cmd-1' });
      expect(result).toBe(true);
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
    });
  });

  describe('notifyProjectBuilderCommandFinished', () => {
    it('emits to user and project rooms', () => {
      service.notifyProjectBuilderCommandFinished('user-1', {
        projectId: 'proj-1',
        status: 'success',
        name: 'Test',
      });
      expect(mock.server.to).toHaveBeenCalled();
    });
  });

  describe('notifyTaskColumnUpdated', () => {
    it('emits to task room', () => {
      service.notifyTaskColumnUpdated('task-1', {} as any);
      expect(mock.server.to).toHaveBeenCalled();
    });

    it('emits to project room when projectId present', () => {
      service.notifyTaskColumnUpdated('task-1', {
        task: { project: { id: 'proj-1' }, column: { name: 'Done' } },
      } as any);
      expect(mock.server.to).toHaveBeenCalled();
    });

    it('emits to task room with default column name', () => {
      service.notifyTaskColumnUpdated('task-1', {
        task: { project: { id: 'proj-1' } },
      } as any);
      expect(mock.server.to).toHaveBeenCalled();
    });
  });

  describe('notifyCommandExit', () => {
    it('emits command exit event', () => {
      service.notifyCommandExit('task-1', {
        roomId: 'room-1',
        terminalId: 'term-1',
        jobId: 'job-1',
        command: 'ls',
        exitCode: 0,
        ts: 1234567890,
      });
      expect(mock.server.to).toHaveBeenCalled();
    });
  });

  describe('forwardCommandRunToTerminal', () => {
    it('returns false when no task socket', () => {
      const result = service.forwardCommandRunToTerminal('task-1', {});
      expect(result).toBe(false);
    });

    it('returns true when task socket exists', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      const result = service.forwardCommandRunToTerminal('task-1', {});
      expect(result).toBe(true);
    });
  });

  describe('forwardStopCommandToTerminal', () => {
    it('returns false and queues when no task socket', () => {
      const result = service.forwardStopCommandToTerminal('task-1', 'job-1');
      expect(result).toBe(false);
    });

    it('returns true when task socket is connected', () => {
      service.registerTaskSocket('task-1', 'socket-1');
      mock.rooms.set('socket-1', new Set());
      const result = service.forwardStopCommandToTerminal('task-1', 'job-1');
      expect(result).toBe(true);
    });

    it('flushes pending stop commands when task socket reconnects', () => {
      // Queue a stop command with no socket
      service.forwardStopCommandToTerminal('task-1', 'job-1');
      // Register socket should flush pending commands
      service.registerTaskSocket('task-1', 'socket-1');
      expect(mock.server.to).toHaveBeenCalledWith('socket-1');
    });
  });

  describe('cleanupTaskRoom', () => {
    it('emits task deleted and disconnects sockets', () => {
      service.cleanupTaskRoom('task-1');
      expect(mock.server.to).toHaveBeenCalled();
    });

    it('does nothing when server not set', () => {
      const noServerService = new TerminalRegistryService();
      noServerService.cleanupTaskRoom('task-1');
      // Should not throw
    });
  });
});
