import { io } from 'socket.io-client';

import { API_BASE } from './api';

export const socket = io(API_BASE || window.location.origin, {
  autoConnect: false,
  path: '/socket.io',
  withCredentials: true,
  transports: ['websocket', 'polling']
});
