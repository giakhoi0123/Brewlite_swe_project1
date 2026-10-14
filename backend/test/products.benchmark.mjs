import { performance } from 'node:perf_hooks';
import { platform } from 'node:os';

// Read-only measurement against a running API backed by the sample database.
// No mock, artificial delay, seed, or database mutation is performed here.
const endpoint = process.argv[2] ?? 'http://localhost:3002/api/products';
const count = Number(process.argv[3] ?? 30);
const warmupCount = 3;

async function measureRequest() {
  const start = performance.now();
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
  if (response.status !== 200) throw new Error(`Expected HTTP 200, received ${response.status}`);
  const products = await response.json();
  const elapsed = performance.now() - start;

  if (!Array.isArray(products) || products.length === 0) {
    throw new Error('A nonempty sample catalog is required for this measurement');
  }
  for (const product of products) {
    if (
      !product || typeof product !== 'object' ||
      Object.keys(product).sort().join(',') !== 'id,imageUrl,name,price' ||
      typeof product.id !== 'string' || !product.id.trim() ||
      typeof product.name !== 'string' || !product.name.trim() ||
      !Number.isInteger(product.price) || product.price < 0 ||
      typeof product.imageUrl !== 'string' || !product.imageUrl.trim()
    ) {
      throw new Error('Response does not match the public Product contract');
    }
  }
  return { elapsed, productCount: products.length };
}

async function main() {
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new Error('Request count must be an integer between 1 and 1000');
  }
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search) {
    throw new Error('Use an HTTP(S) products endpoint without credentials or query parameters');
  }

  for (let index = 0; index < warmupCount; index++) await measureRequest();
  const samples = [];
  const productCounts = new Set();
  for (let index = 0; index < count; index++) {
    const result = await measureRequest();
    samples.push(result.elapsed);
    productCounts.add(result.productCount);
  }
  if (productCounts.size !== 1) throw new Error('Catalog count changed during measurement');
  const sorted = [...samples].sort((a, b) => a - b);
  const round = (value) => Number(value.toFixed(2));
  console.log(JSON.stringify({
    measuredAt: new Date().toISOString(),
    endpoint: url.href,
    node: process.version,
    platform: platform(),
    warmupCount,
    requestCount: count,
    productCount: [...productCounts][0],
    method: 'Sequential HTTP requests; includes response body transfer and JSON parsing',
    milliseconds: {
      min: round(sorted[0]),
      mean: round(samples.reduce((sum, value) => sum + value, 0) / count),
      p50: round(sorted[Math.ceil(count * 0.5) - 1]),
      p95: round(sorted[Math.ceil(count * 0.95) - 1]),
      max: round(sorted[count - 1]),
    },
    allResponsesUnder500ms: sorted[count - 1] < 500,
  }, null, 2));
}

main().catch((error) => {
  const code = error.cause?.code;
  console.error(`Measurement blocked: ${error.message}${code ? ` (${code})` : ''}`);
  process.exitCode = 1;
});
