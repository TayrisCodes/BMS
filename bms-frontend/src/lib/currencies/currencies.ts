import type { Collection, Db, IndexDescription, Document, OptionalUnlessRequiredId } from 'mongodb';
import { getDb } from '@/lib/db';

const CURRENCIES_COLLECTION_NAME = 'currencies';

export interface Currency {
  _id: string;
  organizationId: string;
  code: string; // ISO currency code (e.g., 'ETB', 'USD')
  symbol: string; // Currency symbol (e.g., 'ETB', '$')
  exchangeRate?: number | null; // Exchange rate to primary currency (for USD, rate to ETB)
  rateTimestamp?: Date | null; // When the exchange rate was last updated
  isPrimary: boolean; // Primary currency for the organization
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExchangeRateHistory {
  _id: string;
  currencyId: string;
  organizationId: string;
  rate: number;
  timestamp: Date;
  createdAt: Date;
}

const EXCHANGE_RATE_HISTORY_COLLECTION_NAME = 'exchangeRateHistory';

export async function getCurrenciesCollection(): Promise<Collection<Currency>> {
  const db = await getDb();
  return db.collection<Currency>(CURRENCIES_COLLECTION_NAME);
}

export async function getExchangeRateHistoryCollection(): Promise<Collection<ExchangeRateHistory>> {
  const db = await getDb();
  return db.collection<ExchangeRateHistory>(EXCHANGE_RATE_HISTORY_COLLECTION_NAME);
}

export async function ensureCurrencyIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());
  const currenciesCollection = database.collection(CURRENCIES_COLLECTION_NAME);
  const historyCollection = database.collection(EXCHANGE_RATE_HISTORY_COLLECTION_NAME);

  const currencyIndexes: IndexDescription[] = [
    // Compound unique index on organizationId and code
    {
      key: { organizationId: 1, code: 1 },
      unique: true,
      name: 'unique_org_currency_code',
    },
    // Index on organizationId and isPrimary
    {
      key: { organizationId: 1, isPrimary: 1 },
      name: 'org_isPrimary',
    },
    // Index on organizationId and isActive
    {
      key: { organizationId: 1, isActive: 1 },
      name: 'org_isActive',
    },
  ];

  const historyIndexes: IndexDescription[] = [
    // Compound index on currencyId and timestamp
    {
      key: { currencyId: 1, timestamp: -1 },
      name: 'currency_timestamp',
    },
    // Index on organizationId
    {
      key: { organizationId: 1 },
      name: 'organizationId',
    },
  ];

  await currenciesCollection.createIndexes(currencyIndexes);
  await historyCollection.createIndexes(historyIndexes);
}

export interface CreateCurrencyInput {
  organizationId: string;
  code: string;
  symbol: string;
  exchangeRate?: number | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export async function createCurrency(input: CreateCurrencyInput): Promise<Currency> {
  const collection = await getCurrenciesCollection();
  const now = new Date();

  // If this currency is set as primary, unset other primary currencies for this organization
  if (input.isPrimary) {
    await collection.updateMany(
      { organizationId: input.organizationId, isPrimary: true } as Document,
      { $set: { isPrimary: false } } as Document,
    );
  }

  // Validate code format (should be 3 uppercase letters)
  if (!/^[A-Z]{3}$/.test(input.code)) {
    throw new Error('Currency code must be 3 uppercase letters (ISO 4217 format)');
  }

  const doc: Omit<Currency, '_id'> = {
    organizationId: input.organizationId,
    code: input.code.toUpperCase(),
    symbol: input.symbol,
    exchangeRate: input.exchangeRate ?? null,
    rateTimestamp: input.exchangeRate ? now : null,
    isPrimary: input.isPrimary ?? false,
    isActive: input.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as OptionalUnlessRequiredId<Currency>);

  // If exchange rate is provided, add to history
  if (input.exchangeRate) {
    await addExchangeRateToHistory(
      result.insertedId.toString(),
      input.organizationId,
      input.exchangeRate,
      now,
    );
  }

  return {
    ...(doc as Currency),
    _id: result.insertedId.toString(),
  } as Currency;
}

export async function findCurrencyById(
  currencyId: string,
  organizationId?: string,
): Promise<Currency | null> {
  const collection = await getCurrenciesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const query: Record<string, unknown> = { _id: new ObjectId(currencyId) };
    if (organizationId) {
      query.organizationId = organizationId;
    }

    return collection.findOne(query as Document);
  } catch {
    return null;
  }
}

export async function findCurrencyByCode(
  code: string,
  organizationId: string,
): Promise<Currency | null> {
  const collection = await getCurrenciesCollection();
  return collection.findOne({
    organizationId,
    code: code.toUpperCase(),
  } as Document);
}

export async function getPrimaryCurrency(organizationId: string): Promise<Currency | null> {
  const collection = await getCurrenciesCollection();
  return collection.findOne({
    organizationId,
    isPrimary: true,
    isActive: true,
  } as Document);
}

export async function listCurrencies(
  organizationId: string,
  activeOnly?: boolean,
): Promise<Currency[]> {
  const collection = await getCurrenciesCollection();

  const query: Record<string, unknown> = { organizationId };
  if (activeOnly) {
    query.isActive = true;
  }

  return collection
    .find(query as Document)
    .sort({ isPrimary: -1, code: 1 })
    .toArray();
}

export interface UpdateCurrencyInput {
  code?: string;
  symbol?: string;
  exchangeRate?: number | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export async function updateCurrency(
  currencyId: string,
  input: UpdateCurrencyInput,
  organizationId?: string,
): Promise<Currency | null> {
  const collection = await getCurrenciesCollection();
  const { ObjectId } = await import('mongodb');

  try {
    const existingCurrency = await findCurrencyById(currencyId, organizationId);
    if (!existingCurrency) {
      return null;
    }

    // If setting as primary, unset other primary currencies
    if (input.isPrimary) {
      await collection.updateMany(
        { organizationId: existingCurrency.organizationId, isPrimary: true } as Document,
        { $set: { isPrimary: false } } as Document,
      );
    }

    const updateDoc: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.code !== undefined) {
      if (!/^[A-Z]{3}$/.test(input.code)) {
        throw new Error('Currency code must be 3 uppercase letters (ISO 4217 format)');
      }
      updateDoc.code = input.code.toUpperCase();
    }
    if (input.symbol !== undefined) {
      updateDoc.symbol = input.symbol;
    }
    if (input.exchangeRate !== undefined) {
      updateDoc.exchangeRate = input.exchangeRate;
      updateDoc.rateTimestamp = input.exchangeRate ? new Date() : null;

      // Add to history if rate changed
      if (input.exchangeRate !== null && input.exchangeRate !== existingCurrency.exchangeRate) {
        await addExchangeRateToHistory(
          currencyId,
          existingCurrency.organizationId,
          input.exchangeRate,
          new Date(),
        );
      }
    }
    if (input.isPrimary !== undefined) {
      updateDoc.isPrimary = input.isPrimary;
    }
    if (input.isActive !== undefined) {
      updateDoc.isActive = input.isActive;
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(currencyId) } as Document,
      { $set: updateDoc } as Document,
      { returnDocument: 'after' },
    );

    return result as Currency | null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    return null;
  }
}

export async function addExchangeRateToHistory(
  currencyId: string,
  organizationId: string,
  rate: number,
  timestamp: Date,
): Promise<void> {
  const collection = await getExchangeRateHistoryCollection();
  const now = new Date();

  const doc: Omit<ExchangeRateHistory, '_id'> = {
    currencyId,
    organizationId,
    rate,
    timestamp,
    createdAt: now,
  };

  await collection.insertOne(doc as OptionalUnlessRequiredId<ExchangeRateHistory>);
}

export async function getExchangeRateHistory(
  currencyId: string,
  startDate?: Date,
  endDate?: Date,
  limit?: number,
): Promise<ExchangeRateHistory[]> {
  const collection = await getExchangeRateHistoryCollection();

  const query: Record<string, unknown> = { currencyId };
  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) {
      (query.timestamp as Record<string, unknown>).$gte = startDate;
    }
    if (endDate) {
      (query.timestamp as Record<string, unknown>).$lte = endDate;
    }
  }

  const cursor = collection.find(query as Document).sort({ timestamp: -1 });
  if (limit) {
    cursor.limit(limit);
  }

  return cursor.toArray();
}

/**
 * Converts an amount from one currency to another.
 */
export async function convertCurrency(
  amount: number,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  organizationId: string,
): Promise<number> {
  if (fromCurrencyCode === toCurrencyCode) {
    return amount;
  }

  const fromCurrency = await findCurrencyByCode(fromCurrencyCode, organizationId);
  const toCurrency = await findCurrencyByCode(toCurrencyCode, organizationId);

  if (!fromCurrency || !toCurrency) {
    throw new Error('Currency not found');
  }

  // Get primary currency
  const primaryCurrency = await getPrimaryCurrency(organizationId);
  if (!primaryCurrency) {
    throw new Error('Primary currency not configured');
  }

  // Convert to primary currency first, then to target currency
  let amountInPrimary = amount;

  if (fromCurrency.code !== primaryCurrency.code) {
    if (!fromCurrency.exchangeRate) {
      throw new Error(`Exchange rate not set for ${fromCurrency.code}`);
    }
    amountInPrimary = amount / fromCurrency.exchangeRate;
  }

  if (toCurrency.code !== primaryCurrency.code) {
    if (!toCurrency.exchangeRate) {
      throw new Error(`Exchange rate not set for ${toCurrency.code}`);
    }
    amountInPrimary = amountInPrimary * toCurrency.exchangeRate;
  }

  return amountInPrimary;
}
