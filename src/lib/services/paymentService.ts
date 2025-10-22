// Payment service abstraction layer
// This allows easy swapping between dummy payments and real processors like CCBill

export interface PaymentRequest {
  creatorId: string;
  fanId: string;
  amountCents: number;
  accessDays: number;
  description?: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
  redirectUrl?: string; // For processors that require redirects
}

export interface PaymentProcessor {
  name: string;
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  validateWebhook?(data: any): Promise<boolean>;
  handleWebhook?(data: any): Promise<void>;
}

// Dummy payment processor for testing
export class DummyPaymentProcessor implements PaymentProcessor {
  name = 'CCBILL'; // Use CCBILL as the processor name for database compatibility

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate a fake transaction ID (prefixed with DUMMY for identification)
    const transactionId = `DUMMY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // For testing, we can simulate different scenarios
    // 90% success rate for realistic testing
    const shouldSucceed = Math.random() > 0.1;

    if (shouldSucceed) {
      return {
        success: true,
        transactionId
      };
    } else {
      return {
        success: false,
        error: 'Payment declined - insufficient funds (simulated failure)'
      };
    }
  }
}

// CCBill processor (placeholder for future implementation)
export class CCBillProcessor implements PaymentProcessor {
  name = 'CCBILL';

  constructor(
    private merchantId: string,
    private subAccountId: string,
    private salt: string,
    private isProduction: boolean = false
  ) {}

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // TODO: Implement CCBill integration
    // This would typically:
    // 1. Generate CCBill form parameters
    // 2. Create a secure hash
    // 3. Return a redirect URL to CCBill's payment form
    
    throw new Error('CCBill integration not yet implemented');
  }

  async validateWebhook(data: any): Promise<boolean> {
    // TODO: Validate CCBill webhook signature
    return false;
  }

  async handleWebhook(data: any): Promise<void> {
    // TODO: Process CCBill webhook data
  }
}

// Payment service that manages different processors
export class PaymentService {
  private processor: PaymentProcessor;

  constructor(processor: PaymentProcessor) {
    this.processor = processor;
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      console.log(`Processing payment with ${this.processor.name}:`, {
        creatorId: request.creatorId,
        fanId: request.fanId,
        amountCents: request.amountCents,
        accessDays: request.accessDays
      });

      const result = await this.processor.processPayment(request);
      
      if (result.success && result.transactionId) {
        console.log(`Payment successful: ${result.transactionId}`);
      } else {
        console.log(`Payment failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Payment processing error:', error);
      return {
        success: false,
        error: 'Payment processing failed due to technical error'
      };
    }
  }

  // Switch to a different processor (useful for A/B testing or fallbacks)
  switchProcessor(processor: PaymentProcessor) {
    this.processor = processor;
  }

  getCurrentProcessor(): string {
    return this.processor.name;
  }
}

// Factory function to create the appropriate payment service
export function createPaymentService(environment: 'development' | 'production' = 'development'): PaymentService {
  if (environment === 'development') {
    return new PaymentService(new DummyPaymentProcessor());
  } else {
    // In production, you would configure CCBill with real credentials
    // const ccbillProcessor = new CCBillProcessor(
    //   process.env.CCBILL_MERCHANT_ID!,
    //   process.env.CCBILL_SUBACCOUNT_ID!,
    //   process.env.CCBILL_SALT!,
    //   true
    // );
    // return new PaymentService(ccbillProcessor);
    
    // For now, still use dummy in production until CCBill is ready
    return new PaymentService(new DummyPaymentProcessor());
  }
}
