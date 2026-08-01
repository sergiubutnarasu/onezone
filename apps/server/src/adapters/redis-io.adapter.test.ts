import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisIoAdapter } from './redis-io.adapter.js';
import { IoAdapter } from '@nestjs/platform-socket.io';

let mockDuplicate: any;
let mockPubClient: any;
let mockServer: any;

vi.mock('redis', () => ({
  createClient: vi.fn(),
}));

vi.mock('@socket.io/redis-adapter', () => ({
  createAdapter: vi.fn(),
}));

vi.mock('@nestjs/platform-socket.io', async () => {
  const actual = await vi.importActual<typeof import('@nestjs/platform-socket.io')>('@nestjs/platform-socket.io');
  return {
    ...actual,
    IoAdapter: class MockIoAdapter extends actual.IoAdapter {
      createIOServer(port: number, options?: any) {
        return mockServer;
      }
    },
  };
});

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockDuplicate = {
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
    };
    mockPubClient = {
      duplicate: vi.fn().mockReturnValue(mockDuplicate),
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
    };
    mockServer = {
      adapter: vi.fn(),
    };
    const { createClient } = await import('redis');
    vi.mocked(createClient).mockReturnValue(mockPubClient);
    const { createAdapter } = await import('@socket.io/redis-adapter');
    vi.mocked(createAdapter).mockReturnValue('mock-adapter' as any);
    adapter = new RedisIoAdapter({} as any);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  it('should be instance of IoAdapter', () => {
    expect(adapter).toBeInstanceOf(IoAdapter);
  });

  it('connects to redis and sets adapter constructor', async () => {
    await adapter.connectToRedis();
    expect(mockPubClient.connect).toHaveBeenCalled();
    expect(mockDuplicate.connect).toHaveBeenCalled();
  });

  it('creates IO server with redis adapter', async () => {
    await adapter.connectToRedis();
    const server = adapter.createIOServer(3000, {});
    expect(server).toBe(mockServer);
    expect(mockServer.adapter).toHaveBeenCalledWith('mock-adapter');
  });
});
