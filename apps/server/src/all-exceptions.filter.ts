import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.normalize(exception, request);

    this.logger.error(
      `${request.method} ${request.url} → ${body.statusCode}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(body.statusCode).json(body);
  }

  private normalize(exception: unknown, request: Request): ErrorResponseBody {
    // NestJS HttpException — already has a status and response shape
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();

      let message: string;
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        // ValidationPipe returns { message: string[] }
        if (Array.isArray(r.message)) {
          message = r.message.join(', ');
        } else {
          message = String(r.message ?? exception.message);
        }
      } else {
        message = exception.message;
      }

      return {
        statusCode,
        error: HttpStatus[statusCode] ?? 'Error',
        message,
      };
    }

    // Prisma known errors → map to appropriate HTTP status
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    // Unknown error — don't leak internals
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    };
  }

  private mapPrismaError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ErrorResponseBody {
    switch (exception.code) {
      case 'P2002': {
        // Unique constraint violation
        const target = exception.meta?.target as string[] | undefined;
        const fields = target?.join(', ') ?? 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: `Duplicate value for ${fields}`,
        };
      }
      case 'P2003': {
        // Foreign key constraint violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Referenced resource not found',
        };
      }
      case 'P2025': {
        // Record not found
        return {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Resource not found',
        };
      }
      case 'P2014': {
        // Required relation violation
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Invalid relation: required relation is missing',
        };
      }
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          message: 'An unexpected database error occurred',
        };
    }
  }
}