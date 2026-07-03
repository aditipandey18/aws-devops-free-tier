import http from 'k6/http';
import { sleep } from 'k6';

export default function() {
  http.get('http://<EC2-public-IP>');
  sleep(1);
}

