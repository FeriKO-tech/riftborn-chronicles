import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TokenPayload } from '@riftborn/shared';

export const CurrentPlayer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TokenPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { tokenPayload: TokenPayload }>();
    return request.tokenPayload;
  },
);
