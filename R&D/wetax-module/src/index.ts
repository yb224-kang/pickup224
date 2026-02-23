// Core exports
export { SessionManager } from "./core/session/session-manager";
export * from "./core/types";

// Scrapper exports
export { BaseScrapper } from "./scrapper/base/base-scrapper";
export { BasePlaywrightScraper } from "./scrapper/base/base-playwright-scraper";
export { WetaxScrapper } from "./scrapper/wetax/wetax-scrapper";
export {
  WetaxPlaywrightScraper,
  type ReportInfo,
  type DownloadFileOptions,
} from "./scrapper/wetax/wetax-playwright-scraper";
export * from "./scrapper/wetax/schema";

// Service exports
export { WetaxService } from "./services/wetax-service";

// Interface exports
export * from "./services/interfaces/certificate.interface";
export * from "./services/interfaces/certificate-signer.interface";
export * from "./services/interfaces/storage.interface";
export * from "./services/interfaces/logger.interface";

// Utility exports
export { splitDateRange } from "./utils/date.util";

