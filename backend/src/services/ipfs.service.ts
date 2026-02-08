import pinataSDK from '@pinata/sdk';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const pinata = new pinataSDK(
  process.env.PINATA_API_KEY || '',
  process.env.PINATA_SECRET_KEY || ''
);

export class IpfsService {
  /**
   * Uploads a file to IPFS via Pinata.
   * @param filePath Path to the local file.
   * @param fileName Optional name for the file on Pinata.
   */
  async uploadFile(filePath: string, fileName?: string) {
    try {
      const readableStreamForFile = fs.createReadStream(filePath);
      const options = {
        pinataMetadata: {
          name: fileName || 'Blip Content',
        }
      };
      
      const result = await pinata.pinFileToIPFS(readableStreamForFile, options);
      return result;
    } catch (error) {
      console.error('Error uploading file to IPFS:', error);
      throw error;
    }
  }

  /**
   * Uploads JSON metadata to IPFS via Pinata.
   * @param metadata JSON object.
   * @param name Optional name for the metadata.
   */
  async uploadJSON(metadata: object, name?: string) {
    try {
      const options = {
        pinataMetadata: {
          name: name || 'Blip Metadata',
        }
      };
      const result = await pinata.pinJSONToIPFS(metadata, options);
      return result;
    } catch (error) {
      console.error('Error uploading JSON to IPFS:', error);
      throw error;
    }
  }
}

export const ipfsService = new IpfsService();
