import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'garage';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    this.bucket = process.env.S3_BUCKET_NAME || 'onezone';

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        'S3 credentials incomplete. ' +
          'Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.',
      );
    }

    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  private prefix(projectId: string, key?: string): string {
    const base = `projects/${projectId}/memories/`;
    return key ? `${base}${key}` : base;
  }

  async list(projectId: string, prefix?: string): Promise<string[]> {
    const fullPrefix = this.prefix(projectId, prefix);
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: fullPrefix,
        ContinuationToken: continuationToken,
      });

      try {
        const response = await this.client.send(command);
        for (const obj of response.Contents || []) {
          if (obj.Key) {
            keys.push(obj.Key.slice(fullPrefix.length));
          }
        }
        continuationToken = response.IsTruncated
          ? response.NextContinuationToken
          : undefined;
      } catch (err: unknown) {
        this.logger.error(`S3 list failed: ${(err as Error).message}`);
        throw new InternalServerErrorException('Failed to list memory files');
      }
    } while (continuationToken);

    return keys;
  }

  async read(projectId: string, key: string): Promise<string | null> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix(projectId, key),
    });

    try {
      const response = await this.client.send(command);
      const body = await response.Body?.transformToString();
      return body ?? null;
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'NoSuchKey') {
        return null;
      }
      throw err;
    }
  }

  async write(projectId: string, key: string, content: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix(projectId, key),
      Body: content,
      ContentType: 'text/markdown',
    });

    try {
      await this.client.send(command);
    } catch (err: unknown) {
      this.logger.error(`S3 write failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to write memory file');
    }
  }

  async delete(projectId: string, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.prefix(projectId, key),
    });

    try {
      await this.client.send(command);
    } catch (err: unknown) {
      this.logger.error(`S3 delete failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to delete memory file');
    }
  }
}
