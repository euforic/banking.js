# TypeScript Support for Banking.js

Banking.js now includes comprehensive TypeScript definitions for enhanced
developer experience, type safety, and better IDE support.

## Installation

```bash
npm install banking
```

TypeScript definitions are automatically included with the package.

## Basic Usage

```typescript
import Banking = require('banking');

// Create a banking instance with type-safe configuration
const bank = new Banking({
  fid: 3001,
  fidOrg: 'Wells Fargo',
  url: 'https://www.example.com/ofx',
  bankId: '123456789',
  user: 'username',
  password: 'password',
  accId: '987654321',
  accType: 'CHECKING' // Autocomplete will suggest valid account types
});
```

## Type-Safe API Usage

### Getting Bank Statements

```typescript
// Type-safe date range configuration
const dateRange: Banking.DateRange = {
  start: 20240101, // YYYYMMDD format
  end: 20241231 // Optional end date
};

bank.getStatement(
  dateRange,
  (error: Banking.BankingError, response: Banking.OFXResponse) => {
    if (error) {
      console.error('Banking error:', error);
      return;
    }

    // Type-safe access to response data
    const transactions =
      response.body.OFX.BANKMSGSRSV1?.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN;

    if (Array.isArray(transactions)) {
      transactions.forEach((txn: Banking.Transaction) => {
        console.log(`${txn.NAME}: ${txn.TRNAMT} (${txn.TRNTYPE})`);
      });
    } else if (transactions) {
      console.log(
        `${transactions.NAME}: ${transactions.TRNAMT} (${transactions.TRNTYPE})`
      );
    }
  }
);
```

### Getting Account List

```typescript
bank.getAccounts(
  (error: Banking.BankingError, response: Banking.OFXResponse) => {
    if (error) {
      console.error('Error:', error);
      return;
    }

    const accountInfo =
      response.body.OFX.SIGNUPMSGSRSV1?.ACCTINFOTRNRS.ACCTINFORS.ACCTINFO;

    if (Array.isArray(accountInfo)) {
      accountInfo.forEach((account: Banking.AccountInfo) => {
        if (account.BANKACCTINFO) {
          console.log(
            'Bank Account:',
            account.BANKACCTINFO.BANKACCTFROM.ACCTID
          );
        } else if (account.CCACCTINFO) {
          console.log('Credit Card:', account.CCACCTINFO.CCACCTFROM.ACCTID);
        }
      });
    }
  }
);
```

### Static Parsing Methods

```typescript
// Parse OFX file with type-safe callback
Banking.parseFile('./statement.ofx', (response: Banking.OFXResponse) => {
  const status = response.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS;
  console.log(`Parse status: ${status.CODE} (${status.SEVERITY})`);
});

// Parse OFX string
Banking.parse(ofxString, (response: Banking.OFXResponse) => {
  console.log('Parsed XML length:', response.xml.length);
});
```

## Key Type Definitions

### Financial Data Types

```typescript
// Precise monetary amounts (string to avoid floating-point precision issues)
type MonetaryAmount = string; // e.g., "1234.56", "-49.95"

// OFX date format
type OFXDate = string; // e.g., "20240101" or "20240101120000"
```

### Account Types

```typescript
type AccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'MONEYMRKT'
  | 'CREDITCARD'
  | 'INVESTMENT';
```

### Transaction Types

```typescript
type TransactionType =
  | 'CREDIT' // Credit/deposit
  | 'DEBIT' // Debit/withdrawal
  | 'DIRECTDEBIT' // Direct debit/ACH withdrawal
  | 'DIRECTDEP' // Direct deposit/ACH credit
  | 'CHECK' // Check transaction
  | 'FEE'; // Bank fee
// ... and more
```

### Configuration Interface

```typescript
interface BankingConfig {
  fid: number; // Required: Financial Institution ID
  url: string; // Required: OFX server URL
  user: string; // Required: Username
  password: string; // Required: Password
  accId: string; // Required: Account ID
  accType: AccountType; // Required: Account type

  fidOrg?: string; // Optional: FI organization name
  bankId?: string; // Optional: Bank routing number
  brokerId?: string; // Optional: Broker ID (for investments)
  clientId?: string; // Optional: Client ID
  appVer?: string; // Optional: App version (default: '1700')
  ofxVer?: string; // Optional: OFX version (default: '102')
  app?: string; // Optional: App identifier (default: 'QWIN')
  'User-Agent'?: string; // Optional: User agent
  'Content-Type'?: string; // Optional: Content type
  Accept?: string; // Optional: Accept header
  Connection?: string; // Optional: Connection header
  headers?: OFXHeader[]; // Optional: Custom header list
}
```

## Advanced Usage

### Working with Different Account Types

```typescript
// Bank account configuration
const bankConfig: Banking.BankingConfig = {
  fid: 3001,
  url: 'https://bank.com/ofx',
  user: 'user',
  password: 'pass',
  accId: '123456789',
  accType: 'CHECKING',
  bankId: '111000000' // Required for bank accounts
};

// Credit card configuration
const ccConfig: Banking.BankingConfig = {
  fid: 7101,
  url: 'https://creditcard.com/ofx',
  user: 'user',
  password: 'pass',
  accId: '1234567890123456',
  accType: 'CREDITCARD'
  // Note: bankId not required for credit cards
};

// Investment account configuration
const investmentConfig: Banking.BankingConfig = {
  fid: 8001,
  url: 'https://broker.com/ofx',
  user: 'user',
  password: 'pass',
  accId: 'INV123456',
  accType: 'INVESTMENT',
  brokerId: 'BROKER123' // Required for investment accounts
};
```

### Error Handling

```typescript
// Type-safe error handling
bank.getStatement(
  dateRange,
  (error: Banking.BankingError, response: Banking.OFXResponse) => {
    if (error) {
      if (error instanceof Error) {
        console.error('Network or parsing error:', error.message);
      } else {
        console.error('Unknown error occurred');
      }
      return;
    }

    // Check OFX response status
    const status = response.body.OFX.SIGNONMSGSRSV1.SONRS.STATUS;
    if (status.CODE !== '0') {
      console.error(`OFX Error: ${status.CODE} (${status.SEVERITY})`);
      if (status.MESSAGE) {
        console.error(`Message: ${status.MESSAGE}`);
      }
    }
  }
);
```

### Custom Headers

```typescript
const config: Banking.BankingConfig = {
  // ... other config
  headers: ['Content-Type', 'Host', 'Content-Length', 'Connection'],
  'Content-Type': 'application/x-ofx',
  'User-Agent': 'MyCustomApp/1.0'
};
```

## Type Safety Benefits

1. **Autocomplete**: IDEs will provide intelligent autocomplete for all
   configuration options and response properties
2. **Type Checking**: TypeScript compiler catches type mismatches at compile
   time
3. **Documentation**: Inline JSDoc comments provide context and examples
4. **Refactoring Safety**: Renaming and refactoring operations are safer with
   type information
5. **API Discovery**: Easily explore available properties and methods through
   IDE intellisense

## Monetary Amount Precision

For financial applications, monetary amounts are typed as `string` rather than
`number` to avoid floating-point precision issues:

```typescript
const transaction: Banking.Transaction = {
  TRNTYPE: 'CREDIT',
  DTPOSTED: '20240101120000.000',
  TRNAMT: '1234.56', // String for precise decimal handling
  FITID: 'TXN123456',
  NAME: 'Deposit'
};

// When working with amounts, convert carefully
const amount = parseFloat(transaction.TRNAMT); // Convert to number when needed
const formatted = parseFloat(transaction.TRNAMT).toFixed(2); // Format for display
```

## Migration from JavaScript

Existing JavaScript code will continue to work without changes. To gradually
adopt TypeScript:

1. Rename `.js` files to `.ts`
2. Add type annotations where helpful
3. Let TypeScript infer types where possible
4. Fix any type errors that surface

The type definitions are designed to be permissive while still providing safety
and autocomplete benefits.
