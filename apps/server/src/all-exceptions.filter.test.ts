import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { Response, Request } from 'express';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

const createMockResponse = () => {
  const json = vi.fn().mockReturnThis();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
};

const createMockArgumentsHost = (req: Partial<Request>, res: Response) =>
  ({
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  }) as ArgumentsHost;

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('handles HttpException with string response', () => {
    const res = createMockResponse();
    const req = { method: 'GET', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Bad Request',
    });
  });

  it('handles HttpException with object response (validation errors)', () => {
    const res = createMockResponse();
    const req = { method: 'POST', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new HttpException(
      { message: ['field is required', 'invalid format'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'field is required, invalid format',
    });
  });

  it('handles HttpException with object response containing message string', () => {
    const res = createMockResponse();
    const req = { method: 'POST', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new HttpException(
      { message: 'Something went wrong' },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Something went wrong',
    });
  });

  it('handles Prisma P2002 unique constraint violation', () => {
    const res = createMockResponse();
    const req = { method: 'POST', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new Prisma.PrismaClientKnownRequestError('P2002 error', {
      clientVersion: '5.0.0',
      code: 'P2002',
      meta: { target: ['email'] },
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Duplicate value for email',
    });
  });

  it('handles Prisma P2003 foreign key constraint violation', () => {
    const res = createMockResponse();
    const req = { method: 'POST', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new Prisma.PrismaClientKnownRequestError('P2003 error', {
      clientVersion: '5.0.0',
      code: 'P2003',
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Referenced resource not found',
    });
  });

  it('handles Prisma P2025 record not found', () => {
    const res = createMockResponse();
    const req = { method: 'GET', url: '/test/123' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new Prisma.PrismaClientKnownRequestError('P2025 error', {
      clientVersion: '5.0.0',
      code: 'P2025',
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Resource not found',
    });
  });

  it('handles Prisma P2014 required relation violation', () => {
    const res = createMockResponse();
    const req = { method: 'POST', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new Prisma.PrismaClientKnownRequestError('P2014 error', {
      clientVersion: '5.0.0',
      code: 'P2014',
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Invalid relation: required relation is missing',
    });
  });

  it('handles unknown Prisma error', () => {
    const res = createMockResponse();
    const req = { method: 'POST', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new Prisma.PrismaClientKnownRequestError('P9999 error', {
      clientVersion: '5.0.0',
      code: 'P9999',
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected database error occurred',
    });
  });

  it('handles HttpException with number response (else branch)', () => {
    const res = createMockResponse();
    const req = { method: 'GET', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);
    const exception = new HttpException(123 as any, HttpStatus.BAD_REQUEST);

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Http Exception',
    });
  });

  it('handles unknown errors', () => {
    const res = createMockResponse();
    const req = { method: 'GET', url: '/test' } as Request;
    const host = createMockArgumentsHost(req, res);

    filter.catch(new Error('Something unexpected'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });
});
