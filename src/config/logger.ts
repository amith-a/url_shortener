import { pino, LoggerOptions } from 'pino';
import { env } from './env';

// export const logger = pino({
//   level: env.LOG_LEVEL,
// });

const options: LoggerOptions = {
  level: env.LOG_LEVEL,
};

if (env.NODE_ENV === 'development') {
  options.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}

export const logger = pino(options);
