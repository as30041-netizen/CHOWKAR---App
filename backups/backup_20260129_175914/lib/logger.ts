/**
 * Application Logger
 * Wraps console methods to prevent noise in production.
 * 
 * Usage:
 * import { logger } from './logger';
 * logger.log('Something happened');
 */

const isProduction = import.meta.env.PROD;

export const logger = {
    log: (message: string, ...args: any[]) => {
        if (!isProduction) {
            console.log(message, ...args);
        }
    },

    info: (message: string, ...args: any[]) => {
        if (!isProduction) {
            console.info(message, ...args);
        }
    },

    debug: (message: string, ...args: any[]) => {
        if (!isProduction) {
            console.debug(message, ...args);
        }
    },

    warn: (message: string, ...args: any[]) => {
        // Warnings are useful in production, but we can filter if needed
        console.warn(message, ...args);
    },

    error: (message: string, ...args: any[]) => {
        // Errors should always be visible
        console.error(message, ...args);
    }
};
