import AppError from '../utils/AppError.js';

const jsonHeaders = { 'content-type': 'application/json' };

export class ApiResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = new Headers();
    this.payload = undefined;
    this.redirectUrl = null;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(payload) {
    this.payload = payload;
    return this;
  }

  redirect(url) {
    this.redirectUrl = url;
    this.statusCode = 302;
    return this;
  }

  toResponse() {
    if (this.redirectUrl) {
      return Response.redirect(this.redirectUrl, this.statusCode);
    }

    return Response.json(this.payload ?? null, {
      status: this.statusCode,
      headers: jsonHeaders,
    });
  }
}

export const errorToResponse = (error) => {
  const status = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : 'Internal server error';

  if (!(error instanceof AppError)) {
    console.error(error);
  }

  return Response.json(
    { success: false, message },
    { status, headers: jsonHeaders }
  );
};

export const runMiddleware = async (middleware, req, res) => {
  await new Promise((resolve, reject) => {
    const next = (error) => (error ? reject(error) : resolve());
    Promise.resolve(middleware(req, res, next)).catch(reject);
  });
};

export const runHandler = async (handler, req) => {
  const res = new ApiResponse();
  await handler(req, res);
  return res.toResponse();
};
