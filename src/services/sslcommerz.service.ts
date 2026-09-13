import SSLCommerzPayment from 'sslcommerz-lts';
import { env } from '../config/env';

interface InitPaymentParams {
  transactionId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  bookingId: string;
}

interface SslInitResponse {
  status: string;
  GatewayPageURL?: string;
  sessionkey?: string;
  failedreason?: string;
}

interface SslValidationResponse {
  status: string; // 'VALID' | 'VALIDATED' | 'FAILED' | 'CANCELLED' | ...
  tran_id: string;
  amount: string;
  currency: string;
  bank_tran_id?: string;
  card_type?: string;
  [key: string]: unknown;
}

function getClient() {
  return new SSLCommerzPayment(
    env.sslcommerz.storeId,
    env.sslcommerz.storePassword,
    env.sslcommerz.isLive
  );
}

/**
 * Creates a payment session with SSLCommerz and returns the gateway URL the
 * frontend must redirect the customer to. success/fail/cancel/ipn URLs all
 * point back at our own callback routes so we always learn the outcome
 * server-to-server (via IPN), never trusting the client-side redirect alone.
 */
export async function initiatePayment(params: InitPaymentParams): Promise<SslInitResponse> {
  const sslcz = getClient();

  const data = {
    total_amount: params.amount,
    currency: 'BDT',
    tran_id: params.transactionId,
    success_url: `${env.appBaseUrl}/api/payments/success`,
    fail_url: `${env.appBaseUrl}/api/payments/fail`,
    cancel_url: `${env.appBaseUrl}/api/payments/cancel`,
    ipn_url: `${env.appBaseUrl}/api/payments/ipn`,
    shipping_method: 'NO',
    product_name: 'Messkhuji Housing Booking',
    product_category: 'Housing',
    product_profile: 'general',
    cus_name: params.customerName,
    cus_email: params.customerEmail,
    cus_add1: 'N/A',
    cus_city: 'N/A',
    cus_postcode: '0000',
    cus_country: 'Bangladesh',
    cus_phone: params.customerPhone,
    value_a: params.bookingId, // custom field round-tripped by SSLCommerz for correlation
  };

  const response: SslInitResponse = await sslcz.init(data);
  return response;
}

/**
 * Server-to-server validation against SSLCommerz's Validation API. This is
 * the only source of truth for "did the payment actually succeed" — the
 * success_url a browser hits can be spoofed/replayed, but this call re-checks
 * directly against SSLCommerz using our store credentials.
 */
export async function validatePayment(valId: string): Promise<SslValidationResponse> {
  const sslcz = getClient();
  const response: SslValidationResponse = await sslcz.validate({ val_id: valId });
  return response;
}
