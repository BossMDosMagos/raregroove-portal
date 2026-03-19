import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn((resolve) => resolve({ data: null, error: null })),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

import { supabase } from '../../../lib/supabase';
import { ensureUserBalance } from '../../../utils/transactionService';

describe('TransactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureUserBalance', () => {
    it('should attempt to create balance record if not exists', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ error: null });
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }));

      await ensureUserBalance('new-user-123');
    });

    it('should handle when balance already exists', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'existing-user', available_balance: 100 },
          error: null,
        }),
      });

      await ensureUserBalance('existing-user');
    });

    it('should call supabase from user_balances table', async () => {
      await ensureUserBalance('any-user');

      const calls = supabase.from.mock.calls;
      const balancesCall = calls.find(c => c[0] === 'user_balances');
      expect(balancesCall).toBeDefined();
    });
  });
});
