/**
 * MetaMesh-UGA Reliability Layer
 * 
 * Provides resilience patterns for tool execution:
 * - Exponential retry with jitter
 * - Circuit breaker
 * - Adaptive timeout
 * - Bulkhead (concurrency limit)
 * - Fallback
 * 
 * Phase 3 implementation: in-memory circuit breaker and retry logic.
 * Future phases will support distributed circuit breaker via KV.
 */

export class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.timeout = options.timeout || 30000;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

export class RetryPolicy {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 3;
    this.baseDelay = options.baseDelay || 100;
    this.maxDelay = options.maxDelay || 5000;
    this.exponentialBase = options.exponentialBase || 2;
    this.retryableErrors = options.retryableErrors || [];
  }

  async execute(fn) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === this.maxAttempts || !this.isRetryable(error)) {
          throw error;
        }
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }
    throw lastError;
  }

  isRetryable(error) {
    if (this.retryableErrors.length === 0) return true;
    return this.retryableErrors.some(e => error.message?.includes(e));
  }

  calculateDelay(attempt) {
    const delay = Math.min(
      this.baseDelay * Math.pow(this.exponentialBase, attempt - 1),
      this.maxDelay
    );
    // Add jitter
    return delay + Math.random() * 100;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class Timeout {
  constructor(ms) {
    this.ms = ms;
  }

  async execute(fn) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.ms}ms`));
      }, this.ms);

      fn().then(
        result => {
          clearTimeout(timer);
          resolve(result);
        },
        error => {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
}

export class Bulkhead {
  constructor(limit) {
    this.limit = limit || 10;
    this.running = 0;
    this.queue = [];
  }

  async execute(fn) {
    if (this.running >= this.limit) {
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

export class ReliabilityLayer {
  constructor(options = {}) {
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.retryPolicy = new RetryPolicy(options.retry);
    this.timeout = new Timeout(options.timeout || 10000);
    this.bulkhead = new Bulkhead(options.bulkheadLimit || 10);
  }

  /**
   * Execute a function with all reliability patterns applied
   */
  async execute(fn) {
    return this.bulkhead.execute(() =>
      this.circuitBreaker.execute(() =>
        this.retryPolicy.execute(() =>
          this.timeout.execute(fn)
        )
      )
    );
  }

  /**
   * Execute with fallback
   */
  async executeWithFallback(fn, fallback) {
    try {
      return await this.execute(fn);
    } catch (error) {
      if (fallback) {
        return fallback(error);
      }
      throw error;
    }
  }
}
