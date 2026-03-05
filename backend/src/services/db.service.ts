import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(process.cwd(), 'db.json');

interface Intent {
  intentId: string;
  user: string;
  amount: string;
  recipient: string;
  destinationChainSelector: string;
  ccipMessageId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  baseTxHash?: string;
  error?: string;
  timestamp: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  address: string;
  worldIdVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Database {
  intents: Intent[];
  users: User[];
}

class DbService {
  private db: Database = { intents: [], users: [] };

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const data = fs.readFileSync(DB_FILE, 'utf-8');
        this.db = JSON.parse(data);
      } catch (e) {
        console.error('Failed to load db.json, starting fresh', e);
      }
    } else {
      this.save();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2));
    } catch (e) {
      console.error('Failed to save db.json', e);
    }
  }

  // INTENTS
  async createIntent(data: Partial<Intent>) {
    const now = new Date().toISOString();
    const newIntent: Intent = {
      intentId: data.intentId || `intent_${Date.now()}`,
      user: data.user!,
      amount: data.amount!,
      recipient: data.recipient!,
      destinationChainSelector: data.destinationChainSelector!,
      ccipMessageId: data.ccipMessageId!,
      status: 'PENDING',
      timestamp: data.timestamp || now,
      createdAt: now,
      updatedAt: now,
      ...data
    };
    this.db.intents.push(newIntent);
    this.save();
    return newIntent;
  }

  async updateIntent(intentId: string, updates: Partial<Intent>) {
    const index = this.db.intents.findIndex(i => i.intentId === intentId);
    if (index !== -1) {
      this.db.intents[index] = {
        ...this.db.intents[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.save();
      return this.db.intents[index];
    }
    return null;
  }

  async findIntentById(intentId: string) {
    return this.db.intents.find(i => i.intentId === intentId) || null;
  }

  async findIntentsByUser(address: string) {
    return this.db.intents
      .filter(i => i.user.toLowerCase() === address.toLowerCase())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // USERS
  async getOrCreateUser(address: string) {
    const user = this.db.users.find(u => u.address.toLowerCase() === address.toLowerCase());
    if (user) return user;

    const now = new Date().toISOString();
    const newUser: User = {
      address: address.toLowerCase(),
      worldIdVerified: false,
      createdAt: now,
      updatedAt: now
    };
    this.db.users.push(newUser);
    this.save();
    return newUser;
  }

  async markUserVerified(address: string) {
    const index = this.db.users.findIndex(u => u.address.toLowerCase() === address.toLowerCase());
    if (index !== -1) {
      this.db.users[index].worldIdVerified = true;
      this.db.users[index].updatedAt = new Date().toISOString();
      this.save();
      return this.db.users[index];
    }
    return null;
  }
}

export const dbService = new DbService();
