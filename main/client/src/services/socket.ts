import { io } from 'socket.io-client';

export const socket = io(window.location.origin, {
  autoConnect: false,
  path: '/socket.io',
  withCredentials: true
});
