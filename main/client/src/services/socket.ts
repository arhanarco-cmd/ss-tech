import { io } from 'socket.io-client';
import { API_BASE } from './api';

export const socket = io(API_BASE, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  autoConnect: true,
});
