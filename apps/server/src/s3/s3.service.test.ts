import { describe, it, expect, vi, beforeEach } from 'vitest';
import { S3Service } from './s3.service.js';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { InternalServerErrorException } from '@nestjs/common';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  ListObjectsV2Command: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  HeadBucketCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

describe('S3Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY_ID: 'test-key',
      S3_SECRET_ACCESS_KEY: 'test-secret',
      S3_BUCKET_NAME: 'test-bucket',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when S3 credentials are incomplete', () => {
    process.env.S3_ENDPOINT = undefined;
    expect(() => new S3Service()).toThrow(InternalServerErrorException);
  });

  it('constructs with valid credentials', () => {
    const service = new S3Service();
    expect(S3Client).toHaveBeenCalledWith({
      region: 'garage',
      endpoint: 'http://localhost:9000',
      credentials: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
      },
      forcePathStyle: true,
    });
  });

  it('lists objects and returns keys', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockResolvedValueOnce({
      Contents: [{ Key: 'projects/p1/memories/file1.md' }, { Key: 'projects/p1/memories/file2.md' }],
      IsTruncated: false,
    });

    const keys = await service.list('p1');
    expect(keys).toEqual(['file1.md', 'file2.md']);
    expect(ListObjectsV2Command).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Prefix: 'projects/p1/memories/',
      ContinuationToken: undefined,
    });
  });

  it('handles pagination in list', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend
      .mockResolvedValueOnce({
        Contents: [{ Key: 'projects/p1/memories/file1.md' }],
        IsTruncated: true,
        NextContinuationToken: 'token1',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'projects/p1/memories/file2.md' }],
        IsTruncated: false,
      });

    const keys = await service.list('p1');
    expect(keys).toEqual(['file1.md', 'file2.md']);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('returns empty array when no contents', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockResolvedValueOnce({
      Contents: undefined,
      IsTruncated: false,
    });

    const keys = await service.list('p1');
    expect(keys).toEqual([]);
  });

  it('throws on list error', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockRejectedValueOnce(new Error('S3 error'));

    await expect(service.list('p1')).rejects.toThrow(InternalServerErrorException);
  });

  it('reads file content', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: vi.fn().mockResolvedValue('file content') },
    });

    const content = await service.read('p1', 'file.md');
    expect(content).toBe('file content');
  });

  it('returns null when key not found', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    const error = new Error('NoSuchKey');
    (error as any).name = 'NoSuchKey';
    mockSend.mockRejectedValueOnce(error);

    const content = await service.read('p1', 'missing.md');
    expect(content).toBeNull();
  });

  it('re-throws non-NoSuchKey read errors', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockRejectedValueOnce(new Error('Unknown S3 error'));

    await expect(service.read('p1', 'file.md')).rejects.toThrow('Unknown S3 error');
  });

  it('writes file content', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockResolvedValueOnce({});

    await service.write('p1', 'file.md', '# Hello');
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'projects/p1/memories/file.md',
      Body: '# Hello',
      ContentType: 'text/markdown',
    });
  });

  it('throws on write error', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockRejectedValueOnce(new Error('S3 write error'));

    await expect(service.write('p1', 'file.md', 'content')).rejects.toThrow(InternalServerErrorException);
  });

  it('deletes file', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockResolvedValueOnce({});

    await service.delete('p1', 'file.md');
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket',
      Key: 'projects/p1/memories/file.md',
    });
  });

  it('throws on delete error', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockRejectedValueOnce(new Error('S3 delete error'));

    await expect(service.delete('p1', 'file.md')).rejects.toThrow(InternalServerErrorException);
  });

  it('pings via HeadBucketCommand', async () => {
    const service = new S3Service();
    const mockSend = vi.mocked(S3Client).mock.results[0].value.send;
    mockSend.mockResolvedValueOnce({});

    await service.ping();
    expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'test-bucket' });
  });
});
