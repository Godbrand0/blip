import { MongoClient, Db, Collection, Document, ServerApiVersion } from 'mongodb';

// Define interfaces for our models
export interface User extends Document {
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Intent extends Document {
  intentId: string;
  user: string;
  amount: string;
  recipient: string;
  burnTxHash: string;
  messageHash?: string;
  messageBytes?: string;
  status: 'PENDING' | 'RELAYING' | 'COMPLETED' | 'FAILED';
  baseTxHash?: string;
  error?: string;
  onChainRecordId?: string;
  timestamp: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  await client.connect();
  db = client.db('blip'); // Explicitly use 'blip' database
  console.log('Connected to MongoDB');
  return db;
}

export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const database = await connectToDatabase();
  return database.collection<T>(name);
}

export const collections = {
  get users() { return getCollection<User>('User'); },
  get intents() { return getCollection<Intent>('Intent'); }
};
