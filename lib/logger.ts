/**
 * Production-safe logging utility
 * Logs are only printed in development mode
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const logger = {
    log: (...args: unknown[]) => {
        if (isDev) console.log(...args);
    },
    warn: (...args: unknown[]) => {
        if (isDev) console.warn(...args);
    },
    error: (...args: unknown[]) => {
        // Always log errors, even in production
        console.error(...args);
    },
    debug: (...args: unknown[]) => {
        if (isDev) console.debug(...args);
    },
    info: (...args: unknown[]) => {
        if (isDev) console.info(...args);
    }
};

export default logger;
