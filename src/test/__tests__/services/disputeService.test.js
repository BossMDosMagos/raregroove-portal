import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: 'disputes/dispute-123/evidence.pdf' },
          error: null,
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'evidence-123',
          dispute_id: 'dispute-123',
          file_path: 'disputes/dispute-123/evidence.pdf',
        },
        error: null,
      }),
    }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { supabase } from '../../../lib/supabase';
import { uploadDisputeEvidence } from '../../../utils/disputeService';

describe('DisputeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadDisputeEvidence', () => {
    const createMockFile = (name, type, size) => {
      const blob = new Blob(['test content'], { type });
      Object.defineProperty(blob, 'name', { value: name });
      return blob;
    };

    it('should reject invalid file types', async () => {
      const invalidFile = createMockFile('test.exe', 'application/x-msdownload', 1024);

      const result = await uploadDisputeEvidence({
        disputeId: 'dispute-123',
        file: invalidFile,
      });

      expect(result).toBeNull();
    });

    it('should reject files larger than 10MB', async () => {
      const largeContent = new Array(11 * 1024 * 1024).fill('x').join('');
      const largeFile = new Blob([largeContent], { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'name', { value: 'large.jpg' });

      const result = await uploadDisputeEvidence({
        disputeId: 'dispute-123',
        file: largeFile,
      });

      expect(result).toBeNull();
    });

    it('should return null when user is not authenticated', async () => {
      supabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const file = createMockFile('test.pdf', 'application/pdf', 1024);

      const result = await uploadDisputeEvidence({
        disputeId: 'dispute-123',
        file,
      });

      expect(result).toBeNull();
    });

    it('should accept valid PDF files', async () => {
      const pdfFile = createMockFile('evidence.pdf', 'application/pdf', 1024 * 1024);

      const result = await uploadDisputeEvidence({
        disputeId: 'dispute-123',
        file: pdfFile,
      });

      expect(result).not.toBeNull();
      expect(result.dispute_id).toBe('dispute-123');
    });

    it('should accept valid image files', async () => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

      for (const type of validTypes) {
        supabase.storage.from().upload.mockResolvedValueOnce({
          data: { path: `test.${type.split('/')[1]}` },
          error: null,
        });
        supabase.from().insert().select().single.mockResolvedValueOnce({
          data: { id: 'evidence-new', dispute_id: 'dispute-123' },
          error: null,
        });

        const file = createMockFile(`test.${type.split('/')[1]}`, type, 1024 * 1024);

        const result = await uploadDisputeEvidence({
          disputeId: 'dispute-123',
          file,
        });

        expect(result).not.toBeNull();
      }
    });

    it('should clean up uploaded file on database error', async () => {
      const file = createMockFile('test.pdf', 'application/pdf', 1024);

      supabase.storage.from().upload.mockResolvedValueOnce({
        data: { path: 'disputes/dispute-123/test.pdf' },
        error: null,
      });
      supabase.from().insert().select().single.mockResolvedValueOnce({
        data: null,
        error: new Error('Database insert failed'),
      });

      const result = await uploadDisputeEvidence({
        disputeId: 'dispute-123',
        file,
      });

      expect(result).toBeNull();
      expect(supabase.storage.from().remove).toHaveBeenCalled();
    });
  });
});
