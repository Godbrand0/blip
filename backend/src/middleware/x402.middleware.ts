import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';

/**
 * @dev Middleware for x402 payment validation.
 * Verifies the 'x-payment-token' header using the PaymentService.
 */
export const x402Validation = (req: Request, res: Response, next: NextFunction) => {
  const paymentToken = req.headers['x-payment-token'] as string;

  if (!paymentToken) {
    return res.status(402).json({
      error: 'Payment Required',
      message: 'This resource requires an x402 payment token in the headers.'
    });
  }

  const isValid = paymentService.verifyReceipt(paymentToken);

  if (!isValid) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or expired payment token.'
    });
  }

  next();
};
