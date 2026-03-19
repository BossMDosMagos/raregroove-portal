import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkLoginLockout,
  recordFailedLogin,
  clearLoginAttempts,
  validateHoneyPot,
  validateFormTiming,
} from '../../../utils/security';

describe('Security Utils', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkLoginLockout', () => {
    it('should return isLocked false when no lockout exists', () => {
      const result = checkLoginLockout();
      expect(result.isLocked).toBe(false);
    });

    it('should return isLocked true when lockout is active', () => {
      const lockoutTime = Date.now() + 10 * 60 * 1000;
      localStorage.setItem('rg_auth_lockout', lockoutTime.toString());
      
      const result = checkLoginLockout();
      
      expect(result.isLocked).toBe(true);
      expect(result.remainingMinutes).toBeGreaterThan(0);
    });

    it('should clear expired lockout', () => {
      const expiredTime = Date.now() - 1000;
      localStorage.setItem('rg_auth_lockout', expiredTime.toString());
      localStorage.setItem('rg_auth_attempts', '5');
      
      const result = checkLoginLockout();
      
      expect(result.isLocked).toBe(false);
      expect(localStorage.getItem('rg_auth_lockout')).toBeNull();
    });

    it('should handle cooldown correctly', () => {
      const cooldownUntil = Date.now() + 5000;
      localStorage.setItem('rg_auth_cooldown_until', cooldownUntil.toString());
      
      const result = checkLoginLockout();
      
      expect(result.isLocked).toBe(false);
      expect(result.cooldownSeconds).toBeGreaterThan(0);
    });

    it('should handle identifier-specific lockouts', () => {
      const identifier = 'test@example.com';
      const lockoutTime = Date.now() + 10 * 60 * 1000;
      localStorage.setItem(`rg_auth_lockout:${identifier}`, lockoutTime.toString());
      
      const result = checkLoginLockout(identifier);
      
      expect(result.isLocked).toBe(true);
    });
  });

  describe('recordFailedLogin', () => {
    it('should increment attempts counter', () => {
      const result = recordFailedLogin();
      
      expect(result.isLocked).toBe(false);
      expect(result.attemptsLeft).toBe(4);
      expect(localStorage.getItem('rg_auth_attempts')).toBe('1');
    });

    it('should trigger lockout after 5 failed attempts', () => {
      for (let i = 0; i < 5; i++) {
        recordFailedLogin();
      }
      
      const attempts = localStorage.getItem('rg_auth_attempts');
      const lockout = localStorage.getItem('rg_auth_lockout');
      
      expect(parseInt(attempts)).toBe(5);
      expect(lockout).not.toBeNull();
    });

    it('should apply exponential cooldown', () => {
      const result1 = recordFailedLogin();
      const result2 = recordFailedLogin();
      
      expect(result2.cooldownSeconds).toBeGreaterThan(result1.cooldownSeconds || 1);
    });

    it('should handle identifier-specific attempts', () => {
      const identifier = 'user@test.com';
      recordFailedLogin(identifier);
      
      expect(localStorage.getItem(`rg_auth_attempts:${identifier}`)).toBe('1');
    });
  });

  describe('clearLoginAttempts', () => {
    it('should clear all login attempt data', () => {
      localStorage.setItem('rg_auth_attempts', '5');
      localStorage.setItem('rg_auth_lockout', '12345');
      localStorage.setItem('rg_auth_cooldown_until', '12345');
      
      clearLoginAttempts();
      
      expect(localStorage.getItem('rg_auth_attempts')).toBeNull();
      expect(localStorage.getItem('rg_auth_lockout')).toBeNull();
      expect(localStorage.getItem('rg_auth_cooldown_until')).toBeNull();
    });

    it('should clear identifier-specific data', () => {
      const identifier = 'test@test.com';
      localStorage.setItem(`rg_auth_attempts:${identifier}`, '3');
      
      clearLoginAttempts(identifier);
      
      expect(localStorage.getItem(`rg_auth_attempts:${identifier}`)).toBeNull();
    });
  });

  describe('validateHoneyPot', () => {
    it('should return true when honeypot is empty', () => {
      expect(validateHoneyPot('')).toBe(true);
    });

    it('should return true when honeypot is null', () => {
      expect(validateHoneyPot(null)).toBe(true);
    });

    it('should return false when honeypot is filled (bot detected)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      expect(validateHoneyPot('bot@spam.com')).toBe(false);
      
      consoleSpy.mockRestore();
    });
  });

  describe('validateFormTiming', () => {
    it('should return true for valid timing', () => {
      const startTime = Date.now() - 2000;
      
      expect(validateFormTiming(startTime)).toBe(true);
    });

    it('should return false for too fast submission', () => {
      const startTime = Date.now() - 500;
      
      expect(validateFormTiming(startTime)).toBe(false);
    });

    it('should return false for too slow submission', () => {
      const startTime = Date.now() - 2 * 60 * 60 * 1000;
      
      expect(validateFormTiming(startTime)).toBe(false);
    });

    it('should return false for invalid start time', () => {
      expect(validateFormTiming(0)).toBe(false);
    });

    it('should respect custom minMs', () => {
      const startTime = Date.now() - 3000;
      
      expect(validateFormTiming(startTime, { minMs: 5000 })).toBe(false);
      expect(validateFormTiming(startTime, { minMs: 1000 })).toBe(true);
    });
  });
});
