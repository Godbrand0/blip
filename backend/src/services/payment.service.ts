import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const SECRET_KEY = process.env.JWT_SECRET || 'blip-secret-key-123';

export interface PaymentReceipt {
  contentId: number;
  payer: string;
  timestamp: number;
  signature: string;
}

export class PaymentService {
  /**
   * Generates a payment receipt for a user.
   * In a real system, this would be called after a successful transaction.
   */
  generateReceipt(contentId: number, payer: string): PaymentReceipt {
    const timestamp = Date.now();
    const data = `${contentId}:${payer}:${timestamp}`;
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(data)
      .digest('hex');

    return {
      contentId,
      payer,
      timestamp,
      signature
    };
  }

  /**
   * Verifies an x402 payment token (receipt).
   */
  verifyReceipt(token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const receipt: PaymentReceipt = JSON.parse(decoded);

      const data = `${receipt.contentId}:${receipt.payer}:${receipt.timestamp}`;
      const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(data)
        .digest('hex');

      // Check signature
      if (receipt.signature !== expectedSignature) return false;

      // Check expiration (optional, e.g., 24 hours)
      const isExpired = Date.now() - receipt.timestamp > 86400000;
      if (isExpired) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Encodes a receipt into a base64 token for usage in headers.
   */
  encodeToken(receipt: PaymentReceipt): string {
    return Buffer.from(JSON.stringify(receipt)).toString('base64');
  }
}

export const paymentService = new PaymentService();
