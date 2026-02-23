"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitDateRange = exports.WetaxService = exports.WetaxPlaywrightScraper = exports.WetaxScrapper = exports.BasePlaywrightScraper = exports.BaseScrapper = exports.SessionManager = void 0;
// Core exports
var session_manager_1 = require("./core/session/session-manager");
Object.defineProperty(exports, "SessionManager", { enumerable: true, get: function () { return session_manager_1.SessionManager; } });
__exportStar(require("./core/types"), exports);
// Scrapper exports
var base_scrapper_1 = require("./scrapper/base/base-scrapper");
Object.defineProperty(exports, "BaseScrapper", { enumerable: true, get: function () { return base_scrapper_1.BaseScrapper; } });
var base_playwright_scraper_1 = require("./scrapper/base/base-playwright-scraper");
Object.defineProperty(exports, "BasePlaywrightScraper", { enumerable: true, get: function () { return base_playwright_scraper_1.BasePlaywrightScraper; } });
var wetax_scrapper_1 = require("./scrapper/wetax/wetax-scrapper");
Object.defineProperty(exports, "WetaxScrapper", { enumerable: true, get: function () { return wetax_scrapper_1.WetaxScrapper; } });
var wetax_playwright_scraper_1 = require("./scrapper/wetax/wetax-playwright-scraper");
Object.defineProperty(exports, "WetaxPlaywrightScraper", { enumerable: true, get: function () { return wetax_playwright_scraper_1.WetaxPlaywrightScraper; } });
__exportStar(require("./scrapper/wetax/schema"), exports);
// Service exports
var wetax_service_1 = require("./services/wetax-service");
Object.defineProperty(exports, "WetaxService", { enumerable: true, get: function () { return wetax_service_1.WetaxService; } });
// Interface exports
__exportStar(require("./services/interfaces/certificate.interface"), exports);
__exportStar(require("./services/interfaces/certificate-signer.interface"), exports);
__exportStar(require("./services/interfaces/storage.interface"), exports);
__exportStar(require("./services/interfaces/logger.interface"), exports);
// Utility exports
var date_util_1 = require("./utils/date.util");
Object.defineProperty(exports, "splitDateRange", { enumerable: true, get: function () { return date_util_1.splitDateRange; } });
