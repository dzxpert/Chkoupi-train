/**
 * Chkoupi-lang Tree-Walk Interpreter
 *
 * Uses a scope-chain Environment and JS exceptions as control-flow signals.
 * Builtins:
 *   ektb(fmt, ...args)  — printf-style print  (→ outputCallback)
 *   a9ra(varRef)        — read user input via window.prompt()
 *
 * Safety: MAX_STEPS prevents infinite loops from hanging the browser.
 */

const MAX_STEPS = 200_000;

// ── Control-flow signals ────────────────────────────────────────────────────
class ReturnSignal { constructor(value) { this.value = value; } }

// ── Environment (scope chain) ───────────────────────────────────────────────
class Environment {
  constructor(parent = null) {
    this.vars   = new Map();
    this.consts = new Set();
    this.parent = parent;
  }

  define(name, value, isConst = false) {
    this.vars.set(name, value);
    if (isConst) this.consts.add(name);
  }

  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent)         return this.parent.get(name);
    throw new RuntimeError(`'${name}' mkaynch (undefined variable)`);
  }

  set(name, value) {
    if (this.vars.has(name)) {
      if (this.consts.has(name))
        throw new RuntimeError(`'${name}' hiya dima — ma tebdelch (constant)`);
      this.vars.set(name, value);
      return;
    }
    if (this.parent) { this.parent.set(name, value); return; }
    throw new RuntimeError(`'${name}' mkaynch (undefined variable)`);
  }
}

class RuntimeError extends Error {
  constructor(msg) { super(msg); this.name = 'RuntimeError'; }
}

// ── Interpreter ─────────────────────────────────────────────────────────────
export class Interpreter {
  /**
   * @param {(str: string) => void} outputCb  — called for each ektb() output
   * @param {(prompt: string) => string|null} inputCb — called for a9ra(); defaults to window.prompt
   */
  constructor(outputCb, inputCb) {
    this.output  = outputCb ?? (() => {});
    this.inputFn = inputCb ?? ((msg) => window.prompt(msg) ?? '');
    this.steps   = 0;
    this.globals = new Environment();
    this._setupBuiltins();
  }

  _setupBuiltins() {
    // ektb — printf-style print
    this.globals.define('ektb', (args) => {
      if (args.length === 0) return;
      const fmt = args[0];
      if (typeof fmt !== 'string') { this.output(String(fmt)); return; }
      let i = 1;
      const out = fmt.replace(/%lld|%ld|%d|%lf|%f|%s|%c/g, spec => {
        const v = args[i++];
        if (v === undefined) return spec;
        if (spec === '%lld' || spec === '%ld' || spec === '%d') return String(Math.trunc(Number(v)));
        if (spec === '%lf' || spec === '%f')                    return String(Number(v));
        return String(v);
      });
      this.output(out);
    });

    // a9ra — read into variable (handled specially in evalExpr > Call)
    // We register a sentinel so scope lookup doesn't throw.
    this.globals.define('a9ra', '__builtin_a9ra__');
  }

  // ── Entry point ────────────────────────────────────────────────────────────

  run(ast) {
    this.steps = 0;
    this._execList(ast.stmts, this.globals);
  }

  // ── Statement execution ────────────────────────────────────────────────────

  _execList(stmts, env) {
    for (const stmt of stmts) {
      const sig = this._exec(stmt, env);
      if (sig instanceof ReturnSignal) return sig;
    }
  }

  _exec(stmt, env) {
    this._tick();
    switch (stmt.type) {

      case 'VarDecl': {
        const val = this._eval(stmt.init, env);
        env.define(stmt.name, val, stmt.kind === 'dima');
        return;
      }

      case 'ExprStmt':
        this._eval(stmt.expr, env);
        return;

      case 'If': {
        const cond = this._eval(stmt.cond, env);
        if (this._truthy(cond)) {
          return this._execList(stmt.then.stmts, new Environment(env));
        } else if (stmt.else_) {
          return this._execList(stmt.else_.stmts, new Environment(env));
        }
        return;
      }

      case 'While': {
        while (this._truthy(this._eval(stmt.cond, env))) {
          this._tick();
          const sig = this._execList(stmt.body.stmts, new Environment(env));
          if (sig instanceof ReturnSignal) return sig;
        }
        return;
      }

      case 'For': {
        const forEnv = new Environment(env);
        // Init
        if (stmt.init.type === 'VarDecl') {
          forEnv.define(stmt.init.name, this._eval(stmt.init.init, forEnv), stmt.init.kind === 'dima');
        } else {
          this._eval(stmt.init.expr, forEnv);
        }
        // Loop
        while (this._truthy(this._eval(stmt.cond, forEnv))) {
          this._tick();
          const sig = this._execList(stmt.body.stmts, new Environment(forEnv));
          if (sig instanceof ReturnSignal) return sig;
          this._eval(stmt.update, forEnv);
        }
        return;
      }

      case 'Switch': {
        const val = this._eval(stmt.expr, env);
        for (const c of stmt.cases) {
          if (val === this._eval(c.val, env)) {
            const sig = this._exec(c.stmt, new Environment(env));
            if (sig instanceof ReturnSignal) return sig;
            break; // no fall-through
          }
        }
        return;
      }

      case 'Try': {
        try {
          const sig = this._execList(stmt.body.stmts, new Environment(env));
          if (sig instanceof ReturnSignal) return sig;
        } catch (e) {
          if (e instanceof ReturnSignal) return e;
          const sig = this._execList(stmt.handler.stmts, new Environment(env));
          if (sig instanceof ReturnSignal) return sig;
        }
        return;
      }

      case 'FuncDecl': {
        const decl = stmt;
        const fn = (args) => {
          const fnEnv = new Environment(this.globals);
          decl.params.forEach((p, i) => fnEnv.define(p.name, args[i] ?? null));
          const sig = this._execList(decl.body.stmts, fnEnv);
          if (sig instanceof ReturnSignal) return sig.value;
          return null;
        };
        env.define(stmt.name, fn);
        return;
      }

      case 'Block':
        return this._execList(stmt.stmts, new Environment(env));

      case 'Return': {
        const val = stmt.value ? this._eval(stmt.value, env) : null;
        return new ReturnSignal(val);
      }

      case 'Import':
        return; // no-op

      default:
        throw new RuntimeError(`Unknown statement: ${stmt.type}`);
    }
  }

  // ── Expression evaluation ──────────────────────────────────────────────────

  _eval(expr, env) {
    this._tick();
    switch (expr.type) {

      case 'Literal': return expr.value;

      case 'Ident': return env.get(expr.name);

      case 'Assign': {
        const val = this._eval(expr.value, env);
        env.set(expr.name, val);
        return val;
      }

      case 'BinOp': {
        // Short-circuit logical ops
        if (expr.op === 'w') {
          return this._truthy(this._eval(expr.left, env))
            ? this._truthy(this._eval(expr.right, env))
            : false;
        }
        if (expr.op === 'wla') {
          if (this._truthy(this._eval(expr.left, env))) return true;
          return this._truthy(this._eval(expr.right, env));
        }

        const l = this._eval(expr.left,  env);
        const r = this._eval(expr.right, env);
        switch (expr.op) {
          case '+':
            return (typeof l === 'string' || typeof r === 'string')
              ? String(l) + String(r)
              : l + r;
          case '-':  return l - r;
          case '*':  return l * r;
          case '/':
            if (r === 0) throw new RuntimeError('Division by zero — qsma 3la sifr!');
            return (Number.isInteger(l) && Number.isInteger(r)) ? Math.trunc(l / r) : l / r;
          case '%':  return l % r;
          case '==': return l === r;
          case '!=': return l !== r;
          case '<':  return l < r;
          case '>':  return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          default:   throw new RuntimeError(`Unknown operator: ${expr.op}`);
        }
      }

      case 'UnOp': {
        const v = this._eval(expr.operand, env);
        if (expr.op === '-')     return -v;
        if (expr.op === 'machi') return !this._truthy(v);
        throw new RuntimeError(`Unknown unary op: ${expr.op}`);
      }

      case 'Call': {
        // ── a9ra(varName) — special builtin ──
        if (expr.callee === 'a9ra') {
          const arg = expr.args[0];
          if (!arg || arg.type !== 'Ident')
            throw new RuntimeError('a9ra needs a variable name');
          const current = env.get(arg.name);
          const raw = this.inputFn(`3tini 9imt "${arg.name}": `);
          let parsed;
          if (typeof current === 'number' && Number.isInteger(current)) {
            parsed = parseInt(raw, 10);
            if (isNaN(parsed)) parsed = 0;
          } else if (typeof current === 'number') {
            parsed = parseFloat(raw);
            if (isNaN(parsed)) parsed = 0.0;
          } else {
            parsed = raw ?? '';
          }
          env.set(arg.name, parsed);
          return parsed;
        }

        // ── Regular call ──
        const fn = env.get(expr.callee);
        if (typeof fn !== 'function')
          throw new RuntimeError(`'${expr.callee}' machi function`);
        const args = expr.args.map(a => this._eval(a, env));
        return fn(args);
      }

      default:
        throw new RuntimeError(`Unknown expression node: ${expr.type}`);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _truthy(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number')  return v !== 0;
    return true;
  }

  _tick() {
    if (++this.steps > MAX_STEPS)
      throw new RuntimeError(`Step limit (${MAX_STEPS.toLocaleString()}) exceeded — infinite loop?`);
  }
}
