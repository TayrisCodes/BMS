import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is not defined in environment variables');
}

const mongoUri: string = uri;

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (client) {
    return client;
  }

  const newClient = new MongoClient(mongoUri);
  await newClient.connect();
  client = newClient;

  return client;
}

export async function getDb(): Promise<Db> {
  if (db) {
    return db;
  }

  const mongoClient = await getMongoClient();
  db = mongoClient.db(); // uses the DB from the URI

  return db;
}
