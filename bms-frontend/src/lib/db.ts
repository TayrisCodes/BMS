import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

// Use the URI as-is - connection pool settings are configured in MongoClient options
// This is more reliable than parsing and modifying the connection string
const mongoUri: string = uri;

// Global singleton pattern for Next.js serverless environment
// Using globalThis ensures the connection persists across hot reloads in development
// and is properly shared in serverless environments
declare global {
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
  // eslint-disable-next-line no-var
  var _mongoDb: Db | undefined;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  // In development, use global to persist across hot reloads
  // In production, use module-level variable
  if (process.env.NODE_ENV === 'development') {
    if (global._mongoClient) {
      client = global._mongoClient;
    }
  }

  if (client) {
    // MongoDB driver automatically handles connection health
    // No need for manual ping checks - the driver will reconnect if needed
    return client;
  }

  // Create new client with proper connection pooling configuration
  const newClient = new MongoClient(mongoUri, {
    // Connection pool settings
    maxPoolSize: 10, // Maximum number of connections in the pool (safe for M0: 500 limit)
    minPoolSize: 2, // Minimum number of connections to maintain
    maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity

    // Timeout settings
    serverSelectionTimeoutMS: 10000, // 10 seconds timeout for server selection
    connectTimeoutMS: 10000, // 10 seconds timeout for initial connection
    socketTimeoutMS: 45000, // 45 seconds timeout for socket operations

    // Retry settings
    retryWrites: true,
    retryReads: true,
  });

  try {
    await newClient.connect();
    client = newClient;

    // Store in global for development hot reload persistence
    if (process.env.NODE_ENV === 'development') {
      global._mongoClient = client;
    }

    return client;
  } catch (error) {
    // Reset on connection failure
    client = null;
    db = null;
    if (process.env.NODE_ENV === 'development') {
      global._mongoClient = undefined;
      global._mongoDb = undefined;
    }
    throw error;
  }
}

export async function getDb(): Promise<Db> {
  // In development, use global to persist across hot reloads
  if (process.env.NODE_ENV === 'development') {
    if (global._mongoDb) {
      db = global._mongoDb;
    }
  }

  if (db) {
    return db;
  }

  const mongoClient = await getMongoClient();
  db = mongoClient.db(); // uses the DB from the URI

  // Store in global for development hot reload persistence
  if (process.env.NODE_ENV === 'development') {
    global._mongoDb = db;
  }

  return db;
}

// Graceful shutdown function (useful for cleanup, though Next.js handles this automatically)
export async function closeConnection(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    if (process.env.NODE_ENV === 'development') {
      global._mongoClient = undefined;
      global._mongoDb = undefined;
    }
  }
}
