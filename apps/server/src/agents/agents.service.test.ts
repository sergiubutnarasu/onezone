import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentsService } from './agents.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { NotFoundException } from '@nestjs/common';

const createMockPrisma = () =>
  ({
    agent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userAgentSetting: {
      upsert: vi.fn(),
    },
  } as unknown as PrismaService);

describe('AgentsService', () => {
  let service: AgentsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = createMockPrisma();
    service = new AgentsService(prisma);
  });

  describe('findAll', () => {
    it('returns agents with user model override', async () => {
      prisma.agent.findMany.mockResolvedValue([
        {
          id: 'agent-1',
          name: 'Claude',
          model: 'claude-3-opus',
          tag: 'ClaudeCode',
          userSettings: [{ model: 'claude-3-sonnet' }],
        },
        {
          id: 'agent-2',
          name: 'GPT',
          model: 'gpt-4',
          tag: 'Copilot',
          userSettings: [],
        },
      ]);

      const result = await service.findAll('user-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('model', 'claude-3-sonnet');
      expect(result[0]).toHaveProperty('userModel', 'claude-3-sonnet');
      expect(result[0]).toHaveProperty('defaultModel', 'claude-3-opus');
      expect(result[1]).toHaveProperty('model', 'gpt-4');
      expect(result[1]).toHaveProperty('userModel', null);
    });

    it('returns empty array when no agents', async () => {
      prisma.agent.findMany.mockResolvedValue([]);
      const result = await service.findAll('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns agent without user settings when userId not provided', async () => {
      prisma.agent.findUnique.mockResolvedValue({
        id: 'agent-1',
        name: 'Claude',
        model: 'claude-3',
      });
      const result = await service.findOne('agent-1');
      expect(result).toEqual({ id: 'agent-1', name: 'Claude', model: 'claude-3' });
    });

    it('returns agent with user settings when userId provided', async () => {
      prisma.agent.findUnique.mockResolvedValue({
        id: 'agent-1',
        name: 'Claude',
        model: 'claude-3-opus',
        userSettings: [{ model: 'claude-3-sonnet' }],
      });
      const result = await service.findOne('agent-1', 'user-1');
      expect(result).toHaveProperty('model', 'claude-3-sonnet');
      expect(result).toHaveProperty('userModel', 'claude-3-sonnet');
    });

    it('throws NotFoundException when agent not found', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);
      await expect(service.findOne('agent-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when agent not found with userId', async () => {
      prisma.agent.findUnique.mockResolvedValue(null);
      await expect(service.findOne('agent-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('upserts user agent setting and returns updated agent', async () => {
      prisma.agent.findUnique
        .mockResolvedValueOnce({ id: 'agent-1', name: 'Claude' }) // findOne check
        .mockResolvedValueOnce({
          id: 'agent-1',
          name: 'Claude',
          model: 'claude-3-opus',
          userSettings: [{ model: 'claude-3-sonnet' }],
        });
      prisma.userAgentSetting.upsert.mockResolvedValue({});

      const result = await service.update('agent-1', { model: 'claude-3-sonnet' }, 'user-1');
      expect(prisma.userAgentSetting.upsert).toHaveBeenCalledWith({
        where: { userId_agentId: { userId: 'user-1', agentId: 'agent-1' } },
        create: { userId: 'user-1', agentId: 'agent-1', model: 'claude-3-sonnet' },
        update: { model: 'claude-3-sonnet' },
      });
      expect(result).toHaveProperty('model', 'claude-3-sonnet');
    });
  });

  describe('updateGlobal', () => {
    it('updates global agent model and returns updated agent', async () => {
      prisma.agent.findUnique
        .mockResolvedValueOnce({ id: 'agent-1', name: 'Claude' }) // findOne check
        .mockResolvedValueOnce({
          id: 'agent-1',
          name: 'Claude',
          model: 'claude-3-sonnet',
          userSettings: [],
        });
      prisma.agent.update.mockResolvedValue({});

      const result = await service.updateGlobal('agent-1', { model: 'claude-3-sonnet' }, 'user-1');
      expect(prisma.agent.update).toHaveBeenCalledWith({
        where: { id: 'agent-1' },
        data: { model: 'claude-3-sonnet' },
      });
      expect(result).toHaveProperty('model', 'claude-3-sonnet');
    });
  });
});
