import { describe, it, expect } from 'vitest';
import {
  maskEmail,
  maskPhone,
  maskCPF,
  maskRG,
  maskPixKey,
  maskAddress,
  maskName,
} from '../../../utils/sensitiveDataMask';

describe('SensitiveDataMask', () => {
  describe('maskEmail', () => {
    it('should mask email for non-admin users', () => {
      const result = maskEmail('john.doe@example.com');
      expect(result).toContain('@');
      expect(result).not.toBe('john.doe@example.com');
      expect(result).not.toBe('***');
    });

    it('should return full email for admin users', () => {
      expect(maskEmail('john.doe@example.com', true)).toBe('john.doe@example.com');
    });

    it('should handle short local parts', () => {
      const result = maskEmail('jd@example.com');
      expect(result).toContain('@');
      expect(result).not.toBe('jd@example.com');
    });

    it('should handle null/undefined', () => {
      expect(maskEmail(null)).toBe('***');
      expect(maskEmail(undefined)).toBe('***');
      expect(maskEmail('')).toBe('***');
    });

    it('should handle invalid email format', () => {
      expect(maskEmail('notanemail')).toBe('***');
    });
  });

  describe('maskPhone', () => {
    it('should mask phone for non-admin users', () => {
      const result = maskPhone('11999999999');
      expect(result).toContain('****');
      expect(result).not.toBe('11999999999');
    });

    it('should return full phone for admin', () => {
      expect(maskPhone('11999999999', true)).toBe('11999999999');
    });

    it('should handle short phone numbers', () => {
      expect(maskPhone('123')).toBe('***');
    });

    it('should clean non-numeric characters', () => {
      const result = maskPhone('+55 (11) 99999-9999');
      expect(result).toContain('****');
    });

    it('should handle null/undefined', () => {
      expect(maskPhone(null)).toBe('***');
      expect(maskPhone('')).toBe('***');
    });
  });

  describe('maskCPF', () => {
    it('should mask CPF for non-admin users', () => {
      const result = maskCPF('12345678901');
      expect(result).toContain('***');
      expect(result).toContain('.');
      expect(result).not.toBe('12345678901');
    });

    it('should return full CPF for admin', () => {
      expect(maskCPF('12345678901', true)).toBe('12345678901');
    });

    it('should clean non-numeric characters', () => {
      const result = maskCPF('123.456.789-01');
      expect(result).toContain('***');
    });

    it('should return *** for invalid CPF', () => {
      expect(maskCPF('12345678')).toBe('***');
      expect(maskCPF('1234567890123')).toBe('***');
    });

    it('should handle null/undefined', () => {
      expect(maskCPF(null)).toBe('***');
      expect(maskCPF('')).toBe('***');
    });
  });

  describe('maskRG', () => {
    it('should mask RG for non-admin users', () => {
      const result = maskRG('123456789');
      expect(result).toContain('***');
      expect(result).not.toBe('123456789');
    });

    it('should return full RG for admin', () => {
      expect(maskRG('123456789', true)).toBe('123456789');
    });

    it('should return *** for short RG', () => {
      expect(maskRG('123')).toBe('***');
    });

    it('should handle null/undefined', () => {
      expect(maskRG(null)).toBe('***');
      expect(maskRG('')).toBe('***');
    });
  });

  describe('maskPixKey', () => {
    it('should mask email PIX key', () => {
      const result = maskPixKey('user@pix.com');
      expect(result).not.toBe('user@pix.com');
      expect(result).not.toBe('***');
    });

    it('should mask phone PIX key', () => {
      const result = maskPixKey('11999999999');
      expect(result).toContain('****');
    });

    it('should mask CPF PIX key', () => {
      const result = maskPixKey('12345678901');
      expect(result).toContain('***');
    });

    it('should mask random PIX key (UUID)', () => {
      const result = maskPixKey('a1b2c3d4e5f6g7h8i9j0');
      expect(result).toContain('****');
    });

    it('should return full key for admin', () => {
      expect(maskPixKey('user@pix.com', true)).toBe('user@pix.com');
    });

    it('should handle null/undefined', () => {
      expect(maskPixKey(null)).toBe('***');
      expect(maskPixKey('')).toBe('***');
    });
  });

  describe('maskAddress', () => {
    it('should mask address for non-admin users', () => {
      const result = maskAddress('Rua das Flores, 123');
      expect(result).toContain('*');
      expect(result).not.toBe('Rua das Flores, 123');
    });

    it('should return full address for admin', () => {
      expect(maskAddress('Rua das Flores, 123', true)).toBe('Rua das Flores, 123');
    });

    it('should handle short words', () => {
      const result = maskAddress('Rua ST');
      expect(result).toContain('*');
    });

    it('should handle null/undefined', () => {
      expect(maskAddress(null)).toBe('***');
      expect(maskAddress('')).toBe('***');
    });
  });

  describe('maskName', () => {
    it('should mask full name for non-admin users', () => {
      const result = maskName('João Silva Santos');
      expect(result).toContain('*');
      expect(result).not.toBe('João Silva Santos');
    });

    it('should return full name for admin', () => {
      expect(maskName('João Silva Santos', true)).toBe('João Silva Santos');
    });

    it('should handle single name', () => {
      const result = maskName('Maria');
      expect(result).not.toBe('Maria');
    });

    it('should handle short names', () => {
      const result = maskName('Jo');
      expect(result).not.toBe('Jo');
    });

    it('should handle null/undefined', () => {
      expect(maskName(null)).toBe('***');
      expect(maskName('')).toBe('***');
    });
  });
});
