"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
/**
 * 기본 콘솔 로거 구현
 */
class ConsoleLogger {
    log(message, ...args) {
        console.log(message, ...args);
    }
    error(message, ...args) {
        console.error(message, ...args);
    }
    warn(message, ...args) {
        console.warn(message, ...args);
    }
    debug(message, ...args) {
        console.debug(message, ...args);
    }
}
exports.ConsoleLogger = ConsoleLogger;
