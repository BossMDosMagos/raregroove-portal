import '@testing-library/jest-dom';
import { vi } from 'vitest';

global.__VITE_ENV__ = 'test';

global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};

window.matchMedia = vi.fn((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

window.URL.createObjectURL = vi.fn(() => 'blob:test');
window.URL.revokeObjectURL = vi.fn();

Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:5173',
    href: 'http://localhost:5173',
    pathname: '/',
    search: '',
    hash: '',
    hostname: 'localhost',
    port: '5173',
    protocol: 'http:',
  },
  writable: true,
});

window.history = {
  pushState: vi.fn(),
  replaceState: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  state: {},
};
