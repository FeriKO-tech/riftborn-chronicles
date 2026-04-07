export interface ApiSuccess<T> {
    success: true;
    data: T;
}
export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        statusCode: number;
    };
}
export type ApiResult<T> = ApiSuccess<T> | ApiError;
export interface HealthResponseDto {
    status: 'ok' | 'degraded';
    timestamp: string;
    services: {
        database: 'ok' | 'error';
        redis: 'ok' | 'error';
    };
}
//# sourceMappingURL=api.types.d.ts.map