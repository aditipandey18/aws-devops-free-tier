import http from 'k6/http';
import { sleep } from 'k6';

export default function() {
  http.get('http://54.177.212.169');
  sleep(1);
}

