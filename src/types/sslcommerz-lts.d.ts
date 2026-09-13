declare module 'sslcommerz-lts' {
  export default class SSLCommerzPayment {
    constructor(storeId: string, storePassword: string, isLive: boolean);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    init(data: Record<string, unknown>): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validate(data: Record<string, unknown>): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initiateRefund(data: Record<string, unknown>): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refundQuery(data: Record<string, unknown>): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactionQueryBySessionId(data: Record<string, unknown>): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactionQueryByTransactionId(data: Record<string, unknown>): Promise<any>;
  }
}
