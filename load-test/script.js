import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Point this at your EC2 public IP / domain
const BASE_URL = __ENV.BASE_URL || 'http://54.177.212.169';

export const options = {
  scenarios: {
    ramping_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },   // ramp up to 20 users
        { duration: '1m', target: 50 },    // ramp up to 50 users
        { duration: '2m', target: 50 },    // sustain 50 users
        { duration: '30s', target: 100 },  // spike to 100 users
        { duration: '1m', target: 0 },     // ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],   // 95% of requests should be < 800ms
    errors: ['rate<0.05'],              // error rate should be < 5%
  },
};

export default function () {
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, { 'home status is 200': (r) => r.status === 200 });
  errorRate.add(homeRes.status !== 200);
  apiLatency.add(homeRes.timings.duration);

  const itemsRes = http.get(`${BASE_URL}/api/items`);
  check(itemsRes, { 'items status is 200': (r) => r.status === 200 });

  const createRes = http.post(
    `${BASE_URL}/api/items`,
    JSON.stringify({ name: 'load-test-item' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(createRes, { 'create status is 201': (r) => r.status === 201 });

  sleep(1);
}
