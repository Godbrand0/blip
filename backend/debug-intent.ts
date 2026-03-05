import { MongoClient } from 'mongodb';
import { ethers } from 'ethers';

const uri = "mongodb+srv://thompsoneregha005_db_user:TmeWtfHlwa5V1gKH@cluster0.8eyqkgc.mongodb.net/?appName=Cluster0";
const intentId = "intent_1772645250125_njd7j";

async function run() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('blip');
    const intents = db.collection('intents');
    
    const intent = await intents.findOne({ intentId });
    console.log('--- Intent Data ---');
    console.log(JSON.stringify(intent, null, 2));
    
    if (intent && intent.burnTxHash) {
      console.log('\n--- Source TX Info ---');
      const rpc = "https://worldchain-sepolia.g.alchemy.com/v2/osqL78vBSMaGRoEXFVgEZUxHa3J8AF25";
      const provider = new ethers.JsonRpcProvider(rpc);
      const receipt = await provider.getTransactionReceipt(intent.burnTxHash);
      if (receipt) {
        console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
        console.log('Logs count:', receipt.logs.length);
        receipt.logs.forEach((log, i) => {
          console.log(`Log ${i} address: ${log.address}`);
          console.log(`Log ${i} topics: ${log.topics}`);
        });
      } else {
        console.log('Receipt not found');
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run();
