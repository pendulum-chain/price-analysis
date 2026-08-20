// One-time setup for the BlindPay OTC price source.
//
// OTC quotes require the full payin-quote endpoint, which needs a receiver (customer) with an
// approved KYC and a blockchain wallet. This script creates a throwaway test customer + wallet
// in the BlindPay *sandbox* so the price service can request OTC quotes. No funds ever move —
// quotes expire after 5 minutes and are never executed.
//
// Usage:
//   1. bun run scripts/setup-blindpay-otc.ts
//      -> prints a terms-of-service link. Open it in a browser and accept. You will be
//         redirected to a URL containing `tos_id=...` — copy that value.
//   2. bun run scripts/setup-blindpay-otc.ts --tos-id <tos_id>
//      -> creates the test customer + blockchain wallet and prints the
//         BLINDPAY_BLOCKCHAIN_WALLET_ID to add to your .env.
//
// For production, point BLINDPAY_BLOCKCHAIN_WALLET_ID at a real receiver's wallet instead.

const BASE_URL = process.env.BLINDPAY_BASE_URL ?? 'https://api.blindpay.com/v1';
const apiKey = process.env.BLINDPAY_API_KEY;
const instanceId = process.env.BLINDPAY_INSTANCE_ID;

if (!apiKey || !instanceId) {
    console.error('BLINDPAY_API_KEY and BLINDPAY_INSTANCE_ID must be set in .env');
    process.exit(1);
}

async function request(method: string, path: string, body?: unknown): Promise<any> {
    const response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(body ? {'Content-Type': 'application/json'} : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${method} ${path} failed: ${response.status} ${response.statusText} - ${text}`);
    }
    return JSON.parse(text);
}

const tosIdArgIndex = process.argv.indexOf('--tos-id');
const tosId = tosIdArgIndex !== -1 ? process.argv[tosIdArgIndex + 1] : undefined;

if (!tosId) {
    // Step 1: generate a TOS acceptance link. Accepting the terms is a manual step.
    const {url} = await request('POST', `/e/instances/${instanceId}/tos`, {
        idempotency_key: crypto.randomUUID(),
        receiver_id: null,
        redirect_url: 'https://example.com/tos-done',
    });
    console.log('Open this link in a browser and accept the terms of service:\n');
    console.log(`  ${url}\n`);
    console.log('After accepting you are redirected to example.com — copy the `tos_id` query');
    console.log('parameter from the address bar, then run:\n');
    console.log('  bun run scripts/setup-blindpay-otc.ts --tos-id <tos_id>');
    process.exit(0);
}

// Step 2: create a sandbox test customer (placeholder KYC data, auto-approved in sandbox) …
const PLACEHOLDER_DOC = 'https://placehold.co/600x400.png';
const customer = await request('POST', `/instances/${instanceId}/customers`, {
    type: 'individual',
    kyc_type: 'standard',
    tos_id: tosId,
    country: 'BR',
    email: 'price-analysis-test@satoshipay.io',
    first_name: 'Price',
    last_name: 'Analysis',
    date_of_birth: '1990-01-01T00:00:00.000Z',
    tax_id: '29029791093',
    address_line_1: 'Rua Teste 1',
    city: 'Sao Paulo',
    state_province_region: 'SP',
    postal_code: '01000000',
    phone_number: '+5511999999999',
    id_doc_country: 'BR',
    id_doc_type: 'PASSPORT',
    id_doc_front_file: PLACEHOLDER_DOC,
    id_doc_back_file: PLACEHOLDER_DOC,
    selfie_file: PLACEHOLDER_DOC,
    proof_of_address_doc_type: 'UTILITY_BILL',
    proof_of_address_doc_file: PLACEHOLDER_DOC,
});
const customerId = customer.data?.id ?? customer.id;
console.log(`Created test customer: ${customerId}`);

// … and a blockchain wallet on a testnet. The address is a burn address — quotes are never
// executed, so nothing is ever sent to it.
const wallet = await request('POST', `/instances/${instanceId}/customers/${customerId}/blockchain-wallets`, {
    name: 'price-analysis OTC quotes',
    network: 'base_sepolia',
    address: '0x000000000000000000000000000000000000dEaD',
    is_account_abstraction: true,
});
const walletId = wallet.data?.id ?? wallet.id;
console.log(`Created blockchain wallet: ${walletId}\n`);
console.log('Add this to your .env:\n');
console.log(`  BLINDPAY_BLOCKCHAIN_WALLET_ID=${walletId}`);
