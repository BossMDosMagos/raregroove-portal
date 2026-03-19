export const createMockSupabaseClient = (overrides = {}) => {
  const mockFrom = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve) => resolve({ data: null, error: null })),
  }));

  const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });

  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    }),
  };

  const mockStorage = {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test/path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  };

  const mockFunctions = {
    invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: mockFrom,
    rpc: mockRpc,
    auth: mockAuth,
    storage: mockStorage,
    functions: mockFunctions,
    ...overrides,
  };
};

export const mockSupabase = createMockSupabaseClient();

export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  user_metadata: {
    full_name: 'Test User',
  },
};

export const mockAdminUser = {
  ...mockUser,
  user_metadata: {
    ...mockUser.user_metadata,
    role: 'admin',
  },
};

export const mockTransaction = {
  id: 'tx-123',
  buyer_id: 'buyer-123',
  seller_id: 'seller-123',
  item_id: 'item-123',
  transaction_type: 'venda',
  price: 100.00,
  platform_fee: 10.00,
  gateway_fee: 3.00,
  total_amount: 116.00,
  net_amount: 90.00,
  shipping_cost: 15.00,
  insurance_cost: 5.00,
  status: 'pago_em_custodia',
  payment_method: 'pix',
  created_at: new Date().toISOString(),
};

export const mockItem = {
  id: 'item-123',
  title: 'Rare CD Test',
  artist: 'Test Artist',
  price: 100.00,
  is_sold: false,
  seller_id: 'seller-123',
};

export const mockProfile = {
  id: 'test-user-id',
  full_name: 'Test User',
  cpf_cnpj: '12345678900',
  phone: '11999999999',
  role: 'user',
};
