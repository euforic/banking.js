// Type definitions for banking.js v1.2.0
// Project: https://github.com/euforic/banking.js
// Definitions by: Claude <noreply@anthropic.com>
// TypeScript Version: 4.0+

/**
 * Represents a monetary amount with precise decimal handling for financial calculations
 * Should be used for all monetary values to ensure accuracy
 */
export type MonetaryAmount = string;

/**
 * OFX date format: YYYYMMDDHHMMSS or YYYYMMDD
 * Examples: '20240101', '20240101120000'
 */
export type OFXDate = string;

/**
 * Standard account types supported by OFX specification
 */
export type AccountType = 'CHECKING' | 'SAVINGS' | 'MONEYMRKT' | 'CREDITCARD' | 'INVESTMENT';

/**
 * Transaction types as defined by OFX specification
 */
export type TransactionType =
  | 'CREDIT' // Credit/deposit transaction
  | 'DEBIT' // Debit/withdrawal transaction
  | 'DIRECTDEBIT' // Direct debit/ACH withdrawal
  | 'DIRECTDEP' // Direct deposit/ACH credit
  | 'CHECK' // Check transaction
  | 'FEE' // Bank fee
  | 'DEP' // Deposit
  | 'ATM' // ATM transaction
  | 'POS' // Point of sale transaction
  | 'XFER' // Transfer
  | 'PAYMENT' // Payment
  | 'CASH' // Cash transaction
  | 'DIVIDEND' // Dividend payment
  | 'INTEREST' // Interest payment
  | 'OTHER'; // Other transaction type

/**
 * Standard HTTP headers used in OFX requests
 */
export type OFXHeader = 'Host' | 'Accept' | 'User-Agent' | 'Content-Type' | 'Content-Length' | 'Connection';

/**
 * Connection pool configuration options for optimized banking operations
 */
export interface ConnectionPoolConfig {
  /** Maximum concurrent connections per host (default: 5) */
  maxSockets?: number;

  /** Maximum idle connections to keep alive (default: 2) */
  maxFreeSockets?: number;

  /** Enable persistent connections (default: true) */
  keepAlive?: boolean;

  /** Keep-alive timeout in milliseconds (default: 30000) */
  keepAliveMsecs?: number;

  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** SSL/TLS protocol version (default: 'TLSv1_2_method') */
  secureProtocol?: string;

  /** Verify SSL certificates (default: true) */
  rejectUnauthorized?: boolean;

  /** Verify server hostname (default: true) */
  checkServerIdentity?: boolean;

  /** Maximum retry attempts on failure (default: 3) */
  maxRetries?: number;

  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;

  /** Enable connection pool metrics collection (default: true) */
  enableMetrics?: boolean;

  /** Metrics reporting interval in milliseconds (default: 60000) */
  metricsInterval?: number;
}

/**
 * Connection pool metrics and statistics
 */
export interface PoolMetrics {
  /** Total number of requests made */
  totalRequests: number;

  /** Currently active connections */
  activeConnections: number;

  /** Number of times existing connections were reused */
  poolHits: number;

  /** Number of times new connections were created */
  poolMisses: number;

  /** Total number of errors encountered */
  errors: number;

  /** Total number of retries performed */
  retries: number;

  /** Average response time in milliseconds */
  averageResponseTime: number;

  /** Recent response times array */
  requestTimes: number[];

  /** Per-agent connection statistics */
  poolStats: {
    [agentKey: string]: {
      sockets: number;
      freeSockets: number;
      requests: number;
    };
  };

  /** Total number of HTTP agents */
  agentCount: number;
}

/**
 * Cache configuration options for banking operations
 */
export interface CacheConfig {
  /** Enable/disable caching globally (default: true) */
  enabled?: boolean;

  /** Maximum number of cache entries (default: 1000) */
  maxSize?: number;

  /** Default TTL in milliseconds (default: 300000 - 5 minutes) */
  defaultTTL?: number;

  /** Cache cleanup interval in milliseconds (default: 300000 - 5 minutes) */
  cleanupInterval?: number;

  /** Operation-specific TTL and configuration */
  operationTTL?: {
    /** Account information caching */
    accounts?: CacheOperationConfig;

    /** Balance information caching */
    balance?: CacheOperationConfig;

    /** Transaction statement caching */
    statement?: CacheStatementConfig;

    /** Institution metadata caching */
    institution?: CacheOperationConfig;

    /** Authentication/session caching */
    auth?: CacheOperationConfig;
  };

  /** Security settings for PCI compliance */
  security?: {
    /** Enable encryption for sensitive cached data (default: true) */
    encryptSensitiveData?: boolean;

    /** Encryption key (auto-generated if not provided) */
    encryptionKey?: Buffer | null;

    /** Fields that should never be cached in plain text */
    sensitiveFields?: string[];

    /** Enable secure key generation with salts (default: true) */
    useSecureKeys?: boolean;

    /** Salt for key generation (auto-generated if not provided) */
    salt?: Buffer | null;
  };

  /** Cache storage configuration */
  storage?: {
    /** Storage type: 'memory', 'redis', 'file' (default: 'memory') */
    type?: 'memory' | 'redis' | 'file';

    /** Storage-specific options */
    options?: {
      memory?: {
        /** Use WeakRef for memory-sensitive environments */
        useWeakRef?: boolean;
      };
      redis?: {
        host?: string;
        port?: number;
        db?: number;
        keyPrefix?: string;
      };
    };
  };

  /** Cache warming configuration */
  warming?: {
    /** Enable cache warming (default: false) */
    enabled?: boolean;

    /** Preload frequently accessed data */
    preloadAccounts?: boolean;
    preloadRecentStatements?: boolean;

    /** Warming schedule (cron-like format) */
    schedule?: {
      accounts?: string;
      statements?: string;
    };
  };

  /** Monitoring and metrics configuration */
  metrics?: {
    /** Enable metrics collection (default: true) */
    enabled?: boolean;

    /** Track cache hit rate (default: true) */
    trackHitRate?: boolean;

    /** Track response time (default: true) */
    trackResponseTime?: boolean;

    /** Track memory usage (default: true) */
    trackMemoryUsage?: boolean;

    /** Metrics collection interval in milliseconds (default: 60000) */
    metricsInterval?: number;
  };
}

/**
 * Cache operation configuration
 */
export interface CacheOperationConfig {
  /** TTL in milliseconds */
  ttl: number;

  /** Enable caching for this operation (default: true) */
  enabled?: boolean;

  /** Maximum entries for this operation type */
  maxEntries?: number;
}

/**
 * Statement cache configuration with dynamic TTL
 */
export interface CacheStatementConfig extends CacheOperationConfig {
  /** Dynamic TTL based on query characteristics */
  dynamicTTL?: {
    /** Historical data TTL (older than 30 days) */
    historical?: number;

    /** Recent data TTL (last 30 days) */
    recent?: number;

    /** Real-time data TTL (today) */
    realtime?: number;
  };
}

/**
 * Cache metrics and performance statistics
 */
export interface CacheMetrics {
  /** Request statistics */
  requests: {
    /** Cache hits */
    hits: number;

    /** Cache misses */
    misses: number;

    /** Cache sets */
    sets: number;

    /** Cache invalidations */
    invalidations: number;

    /** Cache clears */
    clears: number;

    /** Requests when caching was disabled */
    disabled: number;
  };

  /** Performance metrics */
  performance: {
    /** Cache hit rate percentage */
    hitRate: number;

    /** Average response time for all operations */
    averageResponseTime: number;

    /** Average response time for cache hits */
    averageHitResponseTime: number;

    /** Average response time for cache sets */
    averageSetResponseTime: number;
  };

  /** Cache storage metrics */
  cache: {
    /** Current cache size */
    size: number;

    /** Maximum cache size */
    maxSize: number;

    /** Cache utilization percentage */
    utilizationPercent: number;
  };

  /** Error statistics */
  errors: {
    /** Errors during cache get operations */
    get: number;

    /** Errors during cache set operations */
    set: number;

    /** Errors during cache invalidation */
    invalidate: number;

    /** Errors during cache clear operations */
    clear: number;
  };

  /** Runtime metrics */
  uptime: number;
  lastCleanup: number;

  /** Configuration snapshot */
  config: {
    enabled: boolean;
    operationTTL: Record<string, CacheOperationConfig>;
  };
}

/**
 * Banking constructor configuration options
 */
export interface BankingConfig {
  /** Financial Institution ID - uniquely identifies the bank */
  fid: number;

  /** Financial Institution Organization name */
  fidOrg?: string;

  /** OFX server URL endpoint */
  url: string;

  /** Bank routing number (required for bank accounts, not for credit cards) */
  bankId?: string;

  /** Username for bank login */
  user: string;

  /** Password for bank login */
  password: string;

  /** Account ID/number */
  accId: string;

  /** Broker ID (required for investment accounts) */
  brokerId?: string;

  /** Account type */
  accType: AccountType;

  /** Client ID for the application (optional) */
  clientId?: string;

  /** Application version (default: '1700') */
  appVer?: string;

  /** OFX version to use (default: '102') */
  ofxVer?: string;

  /** Application identifier (default: 'QWIN') */
  app?: string;

  /** User-Agent header (default: 'banking-js') */
  'User-Agent'?: string;

  /** Content-Type header (default: 'application/x-ofx') */
  'Content-Type'?: string;

  /** Accept header (default: 'application/ofx') */
  Accept?: string;

  /** Connection header (default: 'Close') */
  Connection?: string;

  /** Ordered list of HTTP headers to include in requests */
  headers?: OFXHeader[];

  /** Enable connection pooling for improved performance (default: true) */
  usePooling?: boolean;
}

/**
 * Date range for statement requests
 */
export interface DateRange {
  /** Start date in YYYYMMDD or YYYYMMDDHHMMSS format */
  start: number | OFXDate;

  /** End date in YYYYMMDD or YYYYMMDDHHMMSS format (optional) */
  end?: number | OFXDate;
}

/**
 * Status information from OFX response
 */
export interface OFXStatus {
  /** Status code (0 = success) */
  CODE: string;

  /** Severity level */
  SEVERITY: 'INFO' | 'WARN' | 'ERROR';

  /** Status message (optional) */
  MESSAGE?: string;
}

/**
 * Financial Institution information
 */
export interface FinancialInstitution {
  /** Organization name */
  ORG: string;

  /** Financial Institution ID */
  FID: string;
}

/**
 * Sign-on response structure
 */
export interface SignOnResponse {
  /** Response status */
  STATUS: OFXStatus;

  /** Server date/time */
  DTSERVER: string;

  /** Language code */
  LANGUAGE: string;

  /** Profile last update date (optional) */
  DTPROFUP?: string;

  /** Financial institution info */
  FI: FinancialInstitution;

  /** Intuit-specific fields (optional) */
  'INTU.BID'?: string;
  'INTU.USERID'?: string;
}

/**
 * Bank account identification
 */
export interface BankAccount {
  /** Bank routing number */
  BANKID: string;

  /** Account number */
  ACCTID: string;

  /** Account type */
  ACCTTYPE: AccountType;
}

/**
 * Credit card account identification
 */
export interface CreditCardAccount {
  /** Account number */
  ACCTID: string;
}

/**
 * Investment account identification
 */
export interface InvestmentAccount {
  /** Broker ID */
  BROKERID: string;

  /** Account number */
  ACCTID: string;
}

/**
 * Individual transaction details
 */
export interface Transaction {
  /** Transaction type */
  TRNTYPE: TransactionType;

  /** Date transaction was posted */
  DTPOSTED: string;

  /** Date funds are available (optional) */
  DTAVAIL?: string;

  /** Transaction amount (negative for debits, positive for credits) */
  TRNAMT: MonetaryAmount;

  /** Financial Institution Transaction ID */
  FITID: string;

  /** Check number (for check transactions) */
  CHECKNUM?: string;

  /** Transaction description/name */
  NAME?: string;

  /** Transaction memo/notes */
  MEMO?: string;

  /** Standard Industrial Classification code (optional) */
  SIC?: string;
}

/**
 * Balance information
 */
export interface Balance {
  /** Balance amount */
  BALAMT: MonetaryAmount;

  /** Date/time of balance */
  DTASOF: string;
}

/**
 * Transaction list container
 */
export interface TransactionList {
  /** Start date of transaction range */
  DTSTART: string;

  /** End date of transaction range */
  DTEND: string;

  /** Array of transactions (can be single transaction or array) */
  STMTTRN: Transaction | Transaction[];
}

/**
 * Bank statement response
 */
export interface BankStatementResponse {
  /** Default currency */
  CURDEF: string;

  /** Account information */
  BANKACCTFROM: BankAccount;

  /** Transaction list */
  BANKTRANLIST: TransactionList;

  /** Ledger balance */
  LEDGERBAL: Balance;

  /** Available balance */
  AVAILBAL: Balance;
}

/**
 * Credit card statement response
 */
export interface CreditCardStatementResponse {
  /** Default currency */
  CURDEF: string;

  /** Account information */
  CCACCTFROM: CreditCardAccount;

  /** Transaction list */
  BANKTRANLIST: TransactionList;

  /** Ledger balance */
  LEDGERBAL: Balance;

  /** Available balance */
  AVAILBAL: Balance;
}

/**
 * Statement transaction response wrapper
 */
export interface StatementTransactionResponse {
  /** Transaction unique ID */
  TRNUID: string;

  /** Response status */
  STATUS: OFXStatus;

  /** Client cookie (optional) */
  CLTCOOKIE?: string;

  /** Statement response data */
  STMTRS: BankStatementResponse;
}

/**
 * Credit card statement transaction response wrapper
 */
export interface CreditCardTransactionResponse {
  /** Transaction unique ID */
  TRNUID: string;

  /** Response status */
  STATUS: OFXStatus;

  /** Client cookie (optional) */
  CLTCOOKIE?: string;

  /** Statement response data */
  CCSTMTRS: CreditCardStatementResponse;
}

/**
 * Bank messages response container
 */
export interface BankMessagesResponse {
  /** Statement transaction response */
  STMTTRNRS: StatementTransactionResponse;
}

/**
 * Credit card messages response container
 */
export interface CreditCardMessagesResponse {
  /** Credit card statement transaction response */
  CCSTMTTRNRS: CreditCardTransactionResponse;
}

/**
 * Account information for account list response
 */
export interface AccountInfo {
  /** Bank account info (for bank accounts) */
  BANKACCTINFO?: {
    BANKACCTFROM: BankAccount;
    SVCSTATUS: string;
    XFERSRC?: 'Y' | 'N';
    XFERDEST?: 'Y' | 'N';
    SUPTXDL?: 'Y' | 'N';
  };

  /** Credit card account info (for credit cards) */
  CCACCTINFO?: {
    CCACCTFROM: CreditCardAccount;
    SVCSTATUS: string;
    XFERSRC?: 'Y' | 'N';
    XFERDEST?: 'Y' | 'N';
    SUPTXDL?: 'Y' | 'N';
  };

  /** Investment account info (for investment accounts) */
  INVACCTINFO?: {
    INVACCTFROM: InvestmentAccount;
    SVCSTATUS: string;
    XFERSRC?: 'Y' | 'N';
    XFERDEST?: 'Y' | 'N';
    SUPTXDL?: 'Y' | 'N';
  };
}

/**
 * Account information response
 */
export interface AccountInfoResponse {
  /** Date account info was last updated */
  DTACCTUP: string;

  /** Account information (can be single account or array) */
  ACCTINFO: AccountInfo | AccountInfo[];
}

/**
 * Account list transaction response
 */
export interface AccountListTransactionResponse {
  /** Transaction unique ID */
  TRNUID: string;

  /** Response status */
  STATUS: OFXStatus;

  /** Account information response */
  ACCTINFORS: AccountInfoResponse;
}

/**
 * Sign-up messages response (used for account lists)
 */
export interface SignUpMessagesResponse {
  /** Account information transaction response */
  ACCTINFOTRNRS: AccountListTransactionResponse;
}

/**
 * Complete OFX response body structure
 */
export interface OFXResponseBody {
  OFX: {
    /** Sign-on message response */
    SIGNONMSGSRSV1: {
      SONRS: SignOnResponse;
    };

    /** Bank messages response (for statements) */
    BANKMSGSRSV1?: BankMessagesResponse;

    /** Credit card messages response (for credit card statements) */
    CREDITCARDMSGSRSV1?: CreditCardMessagesResponse;

    /** Sign-up messages response (for account lists) */
    SIGNUPMSGSRSV1?: SignUpMessagesResponse;
  };
}

/**
 * OFX response header information
 */
export interface OFXResponseHeaders {
  /** OFX header version */
  OFXHEADER?: string;

  /** Data type */
  DATA?: string;

  /** OFX version */
  VERSION?: string;

  /** Security level */
  SECURITY?: string;

  /** Text encoding */
  ENCODING?: string;

  /** Character set */
  CHARSET?: string;

  /** Compression type */
  COMPRESSION?: string;

  /** Old file UID */
  OLDFILEUID?: string;

  /** New file UID */
  NEWFILEUID?: string;

  /** HTTP headers (optional) */
  [key: string]: string | undefined;
}

/**
 * Complete parsed OFX response
 */
export interface OFXResponse {
  /** Response headers */
  header: OFXResponseHeaders;

  /** Parsed response body */
  body: OFXResponseBody;

  /** Raw XML string */
  xml: string;
}

/**
 * Base error classification categories
 */
export type ErrorCategory =
  | 'NETWORK'
  | 'AUTHENTICATION'
  | 'BANKING_BUSINESS'
  | 'OFX_PROTOCOL'
  | 'RATE_LIMIT'
  | 'CONFIGURATION'
  | 'DATA'
  | 'UNKNOWN';

/**
 * Banking context for error classification (PCI-compliant - no sensitive data)
 */
export interface BankingContext {
  /** Financial Institution ID */
  fid?: number | null;
  /** Financial Institution Organization name */
  fidOrg?: string | null;
  /** Type of operation being performed */
  operationType?: string | null;
  /** Account type */
  accountType?: AccountType | null;
  /** Sanitized URL (no credentials or sensitive parameters) */
  url?: string | null;
}

/**
 * Technical details for debugging (non-sensitive)
 */
export interface TechnicalDetails {
  /** Original Node.js or HTTP error */
  originalError?: Error | null;
  /** HTTP status code */
  httpStatus?: number | null;
  /** OFX status information */
  ofxStatus?: OFXStatus | null;
  /** Request correlation ID */
  requestId?: string | null;
  /** User agent string */
  userAgent?: string | null;
  /** OFX version used */
  ofxVersion?: string | null;
}

/**
 * Base banking error class with structured information and correlation tracking
 */
export declare class BankingError extends Error {
  /** Error code for programmatic identification */
  readonly code: string;
  /** Unique correlation ID for tracking across requests */
  readonly correlationId: string;
  /** ISO timestamp when error occurred */
  readonly timestamp: string;
  /** Error category for classification */
  readonly category: ErrorCategory;
  /** Whether this error can be retried */
  readonly retryable: boolean;
  /** Recommended retry delay in seconds */
  readonly retryAfter: number | null;
  /** Maximum recommended retry attempts */
  readonly maxRetries: number;
  /** Banking context information (PCI-compliant) */
  readonly bankingContext: BankingContext;
  /** Technical details for debugging */
  readonly technicalDetails: TechnicalDetails;
  /** Actionable recommendations for resolution */
  readonly recommendations: string[];
  /** Additional metadata */
  readonly metadata: Record<string, any>;

  constructor(
    message: string,
    options?: {
      code?: string;
      correlationId?: string;
      timestamp?: string;
      category?: ErrorCategory;
      retryable?: boolean;
      retryAfter?: number | null;
      maxRetries?: number;
      fid?: number;
      fidOrg?: string;
      operationType?: string;
      accountType?: AccountType;
      url?: string;
      originalError?: Error;
      httpStatus?: number;
      ofxStatus?: OFXStatus;
      requestId?: string;
      userAgent?: string;
      ofxVersion?: string;
      recommendations?: string[];
      metadata?: Record<string, any>;
    }
  );

  /** Get PCI-compliant log representation */
  toLogObject(): Record<string, any>;
  /** JSON serialization */
  toJSON(): Record<string, any>;
}

/**
 * Network-related errors
 */
export declare class NetworkError extends BankingError {}
export declare class ConnectionError extends NetworkError {}
export declare class TimeoutError extends NetworkError {}
export declare class DNSError extends NetworkError {}
export declare class CertificateError extends NetworkError {}

/**
 * Authentication and authorization errors
 */
export declare class AuthenticationError extends BankingError {}
export declare class InvalidCredentialsError extends AuthenticationError {}
export declare class ExpiredSessionError extends AuthenticationError {}
export declare class InsufficientPermissionsError extends AuthenticationError {}

/**
 * Banking-specific business logic errors
 */
export declare class BankingBusinessError extends BankingError {}
export declare class AccountNotFoundError extends BankingBusinessError {}
export declare class InsufficientFundsError extends BankingBusinessError {}
export declare class MaintenanceModeError extends BankingBusinessError {}
export declare class DailyLimitExceededError extends BankingBusinessError {}

/**
 * OFX protocol-specific errors
 */
export declare class OFXProtocolError extends BankingError {}
export declare class MalformedResponseError extends OFXProtocolError {}
export declare class VersionMismatchError extends OFXProtocolError {}
export declare class InvalidOFXHeaderError extends OFXProtocolError {}

/**
 * Rate limiting and throttling errors
 */
export declare class RateLimitError extends BankingError {}
export declare class TooManyRequestsError extends RateLimitError {}

/**
 * Configuration and setup errors
 */
export declare class ConfigurationError extends BankingError {}
export declare class InvalidConfigurationError extends ConfigurationError {}
export declare class MissingParameterError extends ConfigurationError {}

/**
 * Data validation and parsing errors
 */
export declare class DataError extends BankingError {}
export declare class InvalidDateRangeError extends DataError {}
export declare class DataParsingError extends DataError {}

/**
 * Error factory function
 */
export declare function createBankingError(
  errorInfo: {
    code?: string;
    message: string;
    httpStatus?: number;
    originalError?: Error;
  },
  options?: Record<string, any>
): BankingError;

/**
 * Union type of all possible banking errors for callback functions
 */
export type BankingErrorType =
  | BankingError
  | NetworkError
  | ConnectionError
  | TimeoutError
  | DNSError
  | CertificateError
  | AuthenticationError
  | InvalidCredentialsError
  | ExpiredSessionError
  | InsufficientPermissionsError
  | BankingBusinessError
  | AccountNotFoundError
  | InsufficientFundsError
  | MaintenanceModeError
  | DailyLimitExceededError
  | OFXProtocolError
  | MalformedResponseError
  | VersionMismatchError
  | InvalidOFXHeaderError
  | RateLimitError
  | TooManyRequestsError
  | ConfigurationError
  | InvalidConfigurationError
  | MissingParameterError
  | DataError
  | InvalidDateRangeError
  | DataParsingError
  | false
  | null;

/**
 * Callback function type for statement operations
 */
export type StatementCallback = (error: BankingErrorType, response: OFXResponse) => void;

/**
 * Callback function type for account list operations
 */
export type AccountListCallback = (error: BankingErrorType, response: OFXResponse) => void;

/**
 * Callback function type for parsing operations
 */
export type ParseCallback = (response: OFXResponse) => void;

/**
 * Main Banking class
 */
declare class Banking {
  /** Library version */
  static readonly version: string;

  /** Banking instance options */
  readonly opts: Required<BankingConfig>;

  /**
   * Creates a new Banking instance
   * @param config Configuration options for the banking connection
   */
  constructor(config: BankingConfig);

  /**
   * Retrieve bank statements for the specified date range
   * @param dateRange Date range for the statement request
   * @param callback Callback function to handle the response
   */
  getStatement(dateRange: DateRange, callback: StatementCallback): void;

  /**
   * Get a list of accounts from the OFX server
   * @param callback Callback function to handle the response
   */
  getAccounts(callback: AccountListCallback): void;

  /**
   * Parse an OFX file from filesystem
   * @param filePath Path to the OFX file
   * @param callback Callback function to handle the parsed response
   */
  static parseFile(filePath: string, callback: ParseCallback): void;

  /**
   * Parse an OFX string directly
   * @param ofxString OFX data as string
   * @param callback Callback function to handle the parsed response
   */
  static parse(ofxString: string, callback: ParseCallback): void;

  /**
   * Configure connection pooling settings for all banking operations
   * @param config Connection pool configuration options
   * @returns Applied pool configuration
   */
  static configurePool(config?: ConnectionPoolConfig): ConnectionPoolConfig;

  /**
   * Get current connection pool metrics and statistics
   * @returns Pool metrics or null if pooling is not enabled
   */
  static getPoolMetrics(): PoolMetrics | null;

  /**
   * Configure caching for banking operations
   * @param config Cache configuration options
   * @returns Applied cache configuration
   */
  static configureCache(config?: CacheConfig): CacheConfig;

  /**
   * Get cache metrics and statistics
   * @returns Cache metrics or null if caching is not enabled
   */
  static getCacheMetrics(): CacheMetrics | null;

  /**
   * Reset cache metrics (useful for testing or monitoring)
   */
  static resetCacheMetrics(): void;

  /**
   * Clear all cached data
   * @returns Number of entries cleared
   */
  static clearCache(): number;

  /**
   * Invalidate cache entries for specific operation
   * @param operation Operation type to invalidate (accounts, statement, etc.)
   * @param params Specific parameters to invalidate (optional)
   * @returns Number of entries invalidated
   */
  static invalidateCache(operation: string, params?: object): number;

  /**
   * Destroy the connection pool and clean up all resources
   * Call this when shutting down your application
   */
  static destroyPool(): void;
}

/**
 * Banking constructor function (alternative to new Banking())
 * @param config Configuration options for the banking connection
 * @returns Banking instance
 */
declare function Banking(config: BankingConfig): Banking;

// Module exports
declare namespace Banking {
  export {
    BankingConfig,
    ConnectionPoolConfig,
    PoolMetrics,
    CacheConfig,
    CacheOperationConfig,
    CacheStatementConfig,
    CacheMetrics,
    DateRange,
    OFXResponse,
    OFXResponseBody,
    OFXResponseHeaders,
    Transaction,
    Balance,
    TransactionList,
    BankAccount,
    CreditCardAccount,
    InvestmentAccount,
    AccountInfo,
    AccountType,
    TransactionType,
    MonetaryAmount,
    OFXDate,
    OFXHeader,
    StatementCallback,
    AccountListCallback,
    ParseCallback,
    // Error types and interfaces
    ErrorCategory,
    BankingContext,
    TechnicalDetails,
    BankingErrorType,
    // Error classes
    BankingError,
    NetworkError,
    ConnectionError,
    TimeoutError,
    DNSError,
    CertificateError,
    AuthenticationError,
    InvalidCredentialsError,
    ExpiredSessionError,
    InsufficientPermissionsError,
    BankingBusinessError,
    AccountNotFoundError,
    InsufficientFundsError,
    MaintenanceModeError,
    DailyLimitExceededError,
    OFXProtocolError,
    MalformedResponseError,
    VersionMismatchError,
    InvalidOFXHeaderError,
    RateLimitError,
    TooManyRequestsError,
    ConfigurationError,
    InvalidConfigurationError,
    MissingParameterError,
    DataError,
    InvalidDateRangeError,
    DataParsingError,
    createBankingError
  };
}

export = Banking;
