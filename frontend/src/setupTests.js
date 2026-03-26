import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

// Axios is ESM-only in newer versions; Jest (CRA) can choke when parsing it.
// Mock axios globally for unit/a11y tests so app modules can import `src/lib/api.js` safely.
jest.mock('axios', () => {
  const mockAxios = {
    create: () => mockAxios,
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
  };
  return { __esModule: true, default: mockAxios };
});

expect.extend(toHaveNoViolations);
