// 간단한 로깅 유틸리티
import { createLogger, format, transports } from 'winston';
import { TransformableInfo } from 'logform';

// 로거 인스턴스 생성
export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'citygml-mcp-server' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info: TransformableInfo) => {
          const { level, message, timestamp, ...metadata } = info;
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0 && !metadata.service) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      )
    })
  ]
});

// 개발 환경에서 더 자세한 로깅 설정
if (process.env.NODE_ENV !== 'production') {
  logger.level = process.env.LOG_LEVEL || 'debug';
} 