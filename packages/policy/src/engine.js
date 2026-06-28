/**
 * MetaMesh-UGA Policy Engine
 * 
 * Lightweight policy evaluator inspired by OPA/Rego.
 * Stores policies as JSON conditions and evaluates them against input.
 * 
 * Phase 2 implementation: simplified condition evaluator.
 * Later phases can integrate with a real OPA/Rego service.
 */

export const OPERATORS = {
  eq: (actual, expected) => actual === expected,
  neq: (actual, expected) => actual !== expected,
  gt: (actual, expected) => actual > expected,
  gte: (actual, expected) => actual >= expected,
  lt: (actual, expected) => actual < expected,
  lte: (actual, expected) => actual <= expected,
  in: (actual, expected) => Array.isArray(expected) && expected.includes(actual),
  not_in: (actual, expected) => Array.isArray(expected) && !expected.includes(actual),
  contains: (actual, expected) => {
    if (typeof actual === 'string') return actual.includes(expected);
    if (Array.isArray(actual)) return actual.includes(expected);
    return false;
  },
  starts_with: (actual, expected) => typeof actual === 'string' && actual.startsWith(expected)
};

export class PolicyEngine {
  constructor(db) {
    this.db = db;
  }

  /**
   * Evaluate a request against all policies
   */
  async evaluate(input) {
    const policies = await this.getPolicies();
    const results = {
      allowed: false,
      denied: false,
      reasons: [],
      decisions: []
    };

    // Sort by priority ascending; lower numbers are evaluated first
    const sorted = policies.sort((a, b) => a.priority - b.priority);

    for (const policy of sorted) {
      const condition = typeof policy.conditions === 'string'
        ? JSON.parse(policy.conditions)
        : policy.conditions;

      const matched = this.evaluateCondition(condition, input);
      const decision = policy.effect === 'allow' ? 'allow' : 'deny';

      if (matched) {
        results.decisions.push({
          policy_id: policy.id,
          policy_name: policy.name,
          decision,
          reason: condition.message || `Matched policy ${policy.name}`
        });

        if (decision === 'allow') {
          results.allowed = true;
        } else {
          results.denied = true;
          results.reasons.push(condition.message || `Denied by policy ${policy.name}`);
        }
      }
    }

    // Deny-by-default unless explicitly allowed and no denies
    results.allowed = results.allowed && !results.denied;

    await this.logEvaluation(input, results);

    return results;
  }

  /**
   * Evaluate a single condition against input
   */
  evaluateCondition(condition, input) {
    const actual = this.getValue(input, condition.field);
    const expected = condition.value;
    const operator = condition.operator || 'eq';

    const fn = OPERATORS[operator];
    if (!fn) {
      console.warn(`Unknown operator: ${operator}`);
      return false;
    }

    return fn(actual, expected);
  }

  /**
   * Get a nested value from input by dot-notation path
   */
  getValue(input, path) {
    if (!path) return undefined;
    const parts = path.split('.');
    let value = input;

    for (const part of parts) {
      if (value === null || value === undefined) return undefined;
      value = value[part];
    }

    return value;
  }

  /**
   * Get all enabled policies
   */
  async getPolicies() {
    const result = await this.db.prepare(
      'SELECT * FROM policies WHERE enabled = TRUE ORDER BY priority'
    ).all();
    return result.results || [];
  }

  /**
   * Create a new policy
   */
  async createPolicy(policy) {
    const result = await this.db.prepare(
      `INSERT INTO policies (name, description, priority, enabled, effect, conditions)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      policy.name,
      policy.description || '',
      policy.priority || 0,
      policy.enabled !== false,
      policy.effect || 'deny',
      JSON.stringify(policy.conditions)
    ).run();

    return {
      id: result.meta?.last_row_id,
      ...policy
    };
  }

  /**
   * Delete a policy
   */
  async deletePolicy(id) {
    await this.db.prepare(
      'DELETE FROM policies WHERE id = ?'
    ).bind(id).run();
    return { deleted: true };
  }

  /**
   * Log evaluation result
   */
  async logEvaluation(input, results) {
    try {
      const toolName = input?.server?.name;
      const userId = input?.user?.id;
      const finalDecision = results.allowed ? 'allow' : 'deny';
      const reason = results.reasons.join('; ') || (finalDecision === 'allow' ? 'Allowed' : 'Deny-by-default');

      // Log the first deny reason or the allow decision
      const policy = results.decisions[0];
      if (policy) {
        await this.db.prepare(
          `INSERT INTO policy_evaluations (policy_id, tool_name, user_id, decision, reason)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
          policy.policy_id,
          toolName,
          userId,
          finalDecision,
          reason
        ).run();
      }
    } catch (error) {
      console.error('Policy evaluation logging failed:', error);
    }
  }
}
