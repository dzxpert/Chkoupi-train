// ===================== CodeMirror 6 Setup =====================
// Importing from local cm-bundle.js (built by esbuild) so all CM6 packages
// share a single @codemirror/state instance — no CDN dedup issues.
import { EditorView, basicSetup, EditorState, StreamLanguage, oneDark } from './cm-bundle.js';

// =============================================================================
// CHKOUPI LEXER
// =============================================================================
const CHKOUPI_KEYWORDS = new Set([
  'dir','dima','idha','idha_mknch','ab9a_dor','dor','a7bss','kml',
  'bdl','khyr','jarb','ila_ghalt','dalla','raja3','jibli',
  'w','wla','machi','sa7','ghalt',
  'tabi3i','3ouchri','5iyar','7arf','nass','fargh','jadwl'
]);

function tokenize(source) {
  const tokens = [];
  let pos = 0;
  const len = source.length;

  const match = (str) => {
    if (source.startsWith(str, pos)) { pos += str.length; return true; }
    return false;
  };

  while (pos < len) {
    if (/\s/.test(source[pos])) { pos++; continue; }
    if (match('//')) { while (pos < len && source[pos] !== '\n') pos++; continue; }
    if (match('/*')) { while (pos < len && !source.startsWith('*/', pos)) pos++; if (pos < len) pos += 2; continue; }

    if (match('->')) { tokens.push({ type: 'ARROW' }); continue; }
    if (match('==')) { tokens.push({ type: 'OP', value: '==' }); continue; }
    if (match('!=')) { tokens.push({ type: 'OP', value: '!=' }); continue; }
    if (match('<=')) { tokens.push({ type: 'OP', value: '<=' }); continue; }
    if (match('>=')) { tokens.push({ type: 'OP', value: '>=' }); continue; }
    if (match('+=')) { tokens.push({ type: 'COMPOUND_ASSIGN', value: '+=' }); continue; }
    if (match('-=')) { tokens.push({ type: 'COMPOUND_ASSIGN', value: '-=' }); continue; }
    if (match('*=')) { tokens.push({ type: 'COMPOUND_ASSIGN', value: '*=' }); continue; }
    if (match('/=')) { tokens.push({ type: 'COMPOUND_ASSIGN', value: '/=' }); continue; }
    if (match('%=')) { tokens.push({ type: 'COMPOUND_ASSIGN', value: '%=' }); continue; }
    if (match('++')) { tokens.push({ type: 'OP', value: '++' }); continue; }
    if (match('--')) { tokens.push({ type: 'OP', value: '--' }); continue; }

    const ch = source[pos];
    if ('+-*/%<>'.includes(ch)) { pos++; tokens.push({ type: 'OP',    value: ch }); continue; }
    if (ch === '=')              { pos++; tokens.push({ type: 'ASSIGN'           }); continue; }
    if (ch === ':')              { pos++; tokens.push({ type: 'COLON'            }); continue; }
    if (ch === ';')              { pos++; tokens.push({ type: 'SEMI'             }); continue; }
    if (ch === ',')              { pos++; tokens.push({ type: 'COMMA'            }); continue; }
    if (ch === '(')              { pos++; tokens.push({ type: 'LPAREN'           }); continue; }
    if (ch === ')')              { pos++; tokens.push({ type: 'RPAREN'           }); continue; }
    if (ch === '{')              { pos++; tokens.push({ type: 'LBRACE'           }); continue; }
    if (ch === '}')              { pos++; tokens.push({ type: 'RBRACE'           }); continue; }
    if (ch === '[')              { pos++; tokens.push({ type: 'LBRACK'           }); continue; }
    if (ch === ']')              { pos++; tokens.push({ type: 'RBRACK'           }); continue; }

    if (ch === '"') {
      pos++;
      let str = '';
      while (pos < len && source[pos] !== '"') {
        if (source[pos] === '\\') {
          pos++;
          const e = source[pos++] ?? '';
          str += e === 'n' ? '\n' : e === 't' ? '\t' : e === '\\' ? '\\' : e === '"' ? '"' : e;
        } else { str += source[pos++]; }
      }
      if (pos < len) pos++;
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    if (ch === "'") {
      pos++;
      let c;
      if (source[pos] === '\\') {
        pos++;
        const e = source[pos++] ?? '';
        c = e === 'n' ? '\n' : e === 't' ? '\t' : e;
      } else { c = source[pos++]; }
      if (pos < len && source[pos] === "'") pos++;
      tokens.push({ type: 'CHAR', value: c });
      continue;
    }

    if (/\d/.test(ch)) {
      const start = pos;
      while (pos < len && /\d/.test(source[pos])) pos++;
      if (pos < len && source[pos] === '.' && pos + 1 < len && /\d/.test(source[pos + 1])) {
        pos++;
        while (pos < len && /\d/.test(source[pos])) pos++;
        tokens.push({ type: 'NUMBER', value: parseFloat(source.slice(start, pos)) });
      } else if (pos < len && /[a-zA-Z_]/.test(source[pos])) {
        while (pos < len && /[a-zA-Z0-9_]/.test(source[pos])) pos++;
        const word = source.slice(start, pos);
        tokens.push({ type: CHKOUPI_KEYWORDS.has(word) ? 'KEYWORD' : 'IDENT', value: word });
      } else {
        tokens.push({ type: 'NUMBER', value: parseInt(source.slice(start, pos), 10) });
      }
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      const start = pos;
      while (pos < len && /[a-zA-Z0-9_]/.test(source[pos])) pos++;
      const word = source.slice(start, pos);
      tokens.push({ type: CHKOUPI_KEYWORDS.has(word) ? 'KEYWORD' : 'IDENT', value: word });
      continue;
    }
    pos++;
  }
  tokens.push({ type: 'EOF' });
  return tokens;
}

// =============================================================================
// CHKOUPI PARSER
// =============================================================================
class ChkoupiParser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }

  peek()    { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }

  check(type, value) {
    const t = this.peek();
    return t.type === type && (value === undefined || t.value === value);
  }
  match(type, value) { if (this.check(type, value)) { this.advance(); return true; } return false; }
  expect(type, value) {
    const t = this.advance();
    if (t.type !== type) throw new SyntaxError(`Expected ${type}${value ? ` "${value}"` : ''}, got ${t.type}${t.value !== undefined ? ` "${t.value}"` : ''}`);
    if (value !== undefined && t.value !== value) throw new SyntaxError(`Expected "${value}", got "${t.value}"`);
    return t;
  }

  parseType() {
    let t = this.advance().value;
    if (this.match('OP', '<')) {
      const sub = this.parseType();
      this.expect('OP', '>');
      t = `${t}<${sub}>`;
    }
    return t;
  }

  parse() {
    const stmts = [];
    while (!this.check('EOF')) stmts.push(this.parseStatement());
    return { type: 'Program', stmts };
  }

  parseBlock() {
    this.expect('LBRACE');
    const stmts = [];
    while (!this.check('RBRACE') && !this.check('EOF')) stmts.push(this.parseStatement());
    this.expect('RBRACE');
    return { type: 'Block', stmts };
  }

  parseStatement() {
    const t = this.peek();
    if (t.type === 'KEYWORD') {
      switch (t.value) {
        case 'dalla':    return this.parseFuncDecl();
        case 'dir':
        case 'dima':     return this.parseVarDecl();
        case 'idha':     return this.parseIf();
        case 'ab9a_dor': return this.parseWhile();
        case 'dor':      return this.parseFor();
        case 'a7bss':    return this.parseBreak();
        case 'kml':      return this.parseContinue();
        case 'bdl':      return this.parseSwitch();
        case 'jarb':     return this.parseTry();
        case 'raja3':    return this.parseReturn();
        case 'jibli':    return this.parseImport();
      }
    }
    return this.parseExprStmt();
  }

  parseFuncDecl() {
    this.expect('KEYWORD', 'dalla');
    const name = this.expect('IDENT').value;
    this.expect('LPAREN');
    const params = [];
    while (!this.check('RPAREN') && !this.check('EOF')) {
      const pname = this.expect('IDENT').value;
      this.expect('COLON');
      const ptype = this.parseType();
      params.push({ name: pname, type: ptype });
      this.match('COMMA');
    }
    this.expect('RPAREN');
    let retType = 'fargh';
    if (this.match('ARROW')) {
      retType = this.parseType();
    }
    const body = this.parseBlock();
    return { type: 'FuncDecl', name, params, retType, body };
  }

  parseVarDecl() {
    const kind = this.advance().value;
    const name = this.expect('IDENT').value;
    let typeAnnot = null;
    if (this.match('COLON')) typeAnnot = this.parseType();
    this.expect('ASSIGN');
    const init = this.parseExpr();
    this.match('SEMI');
    return { type: 'VarDecl', kind, name, typeAnnot, init };
  }

  parseIf() {
    this.expect('KEYWORD', 'idha');
    this.expect('LPAREN');
    const cond = this.parseExpr();
    this.expect('RPAREN');
    const then = this.parseBlock();
    let else_ = null;
    if (this.check('KEYWORD') && this.peek().value === 'idha_mknch') {
      this.advance();
      if (this.check('KEYWORD') && this.peek().value === 'idha') {
        else_ = this.parseIf();
      } else {
        else_ = this.parseBlock();
      }
    }
    return { type: 'If', cond, then, else_ };
  }

  parseBreak() {
    this.expect('KEYWORD', 'a7bss');
    this.match('SEMI');
    return { type: 'Break' };
  }

  parseContinue() {
    this.expect('KEYWORD', 'kml');
    this.match('SEMI');
    return { type: 'Continue' };
  }

  parseWhile() {
    this.expect('KEYWORD', 'ab9a_dor');
    this.expect('LPAREN');
    const cond = this.parseExpr();
    this.expect('RPAREN');
    const body = this.parseBlock();
    return { type: 'While', cond, body };
  }

  parseFor() {
    this.expect('KEYWORD', 'dor');
    this.expect('LPAREN');
    let init = null;
    const t = this.peek();
    if (t.type === 'KEYWORD' && (t.value === 'dir' || t.value === 'dima')) {
      const kind = this.advance().value;
      const name = this.expect('IDENT').value;
      let typeAnnot = null;
      if (this.match('COLON')) typeAnnot = this.advance().value;
      this.expect('ASSIGN');
      init = { type: 'VarDecl', kind, name, typeAnnot, init: this.parseExpr() };
    } else {
      init = { type: 'ExprStmt', expr: this.parseExpr() };
    }
    this.expect('SEMI');
    const cond = this.parseExpr();
    this.expect('SEMI');
    const update = this.parseExpr();
    this.expect('RPAREN');
    const body = this.parseBlock();
    return { type: 'For', init, cond, update, body };
  }

  parseSwitch() {
    this.expect('KEYWORD', 'bdl');
    this.expect('LPAREN');
    const expr = this.parseExpr();
    this.expect('RPAREN');
    this.expect('LBRACE');
    const cases = [];
    while (!this.check('RBRACE') && !this.check('EOF')) {
      this.expect('KEYWORD', 'khyr');
      const val = this.parseExpr();
      this.expect('COLON');
      cases.push({ val, stmt: this.parseStatement() });
    }
    this.expect('RBRACE');
    return { type: 'Switch', expr, cases };
  }

  parseTry() {
    this.expect('KEYWORD', 'jarb');
    const body = this.parseBlock();
    this.expect('KEYWORD', 'ila_ghalt');
    const handler = this.parseBlock();
    return { type: 'Try', body, handler };
  }

  parseReturn() {
    this.expect('KEYWORD', 'raja3');
    let value = null;
    if (!this.check('SEMI') && !this.check('RBRACE') && !this.check('EOF')) value = this.parseExpr();
    this.match('SEMI');
    return { type: 'Return', value };
  }

  parseImport() {
    this.expect('KEYWORD', 'jibli');
    const path = this.expect('STRING').value;
    this.match('SEMI');
    return { type: 'Import', path };
  }

  parseExprStmt() {
    const expr = this.parseExpr();
    this.match('SEMI');
    return { type: 'ExprStmt', expr };
  }

  parseExpr()        { return this.parseAssignment(); }

  parseAssignment() {
    const left = this.parseLogicalOr();
    if (this.check('ASSIGN')) {
      this.advance();
      const right = this.parseAssignment();
      if (left.type !== 'Ident' && left.type !== 'Index') throw new SyntaxError('Invalid assignment target');
      if (left.type === 'Index') {
        return { type: 'IndexAssign', expr: left.expr, index: left.index, value: right };
      }
      return { type: 'Assign', name: left.name, value: right };
    }
    if (this.check('COMPOUND_ASSIGN')) {
      const opTok = this.advance();
      const op = opTok.value.slice(0, -1); // e.g. '+=' => '+'
      const right = this.parseAssignment();
      if (left.type !== 'Ident' && left.type !== 'Index') throw new SyntaxError('Invalid assignment target');
      const desugaredVal = { type: 'BinOp', op, left, right };
      if (left.type === 'Index') {
        return { type: 'IndexAssign', expr: left.expr, index: left.index, value: desugaredVal };
      }
      return { type: 'Assign', name: left.name, value: desugaredVal };
    }
    return left;
  }

  parseLogicalOr() {
    let l = this.parseLogicalAnd();
    while (this.check('KEYWORD', 'wla')) { this.advance(); l = { type: 'BinOp', op: 'wla', left: l, right: this.parseLogicalAnd() }; }
    return l;
  }

  parseLogicalAnd() {
    let l = this.parseNot();
    while (this.check('KEYWORD', 'w')) { this.advance(); l = { type: 'BinOp', op: 'w', left: l, right: this.parseNot() }; }
    return l;
  }

  parseNot() {
    if (this.check('KEYWORD', 'machi')) { this.advance(); return { type: 'UnOp', op: 'machi', operand: this.parseNot() }; }
    return this.parseComparison();
  }

  parseComparison() {
    let l = this.parseAdditive();
    const ops = ['==','!=','<','>','<=','>='];
    while (this.check('OP') && ops.includes(this.peek().value)) {
      const op = this.advance().value; l = { type: 'BinOp', op, left: l, right: this.parseAdditive() };
    }
    return l;
  }

  parseAdditive() {
    let l = this.parseMultiplicative();
    while (this.check('OP') && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.advance().value; l = { type: 'BinOp', op, left: l, right: this.parseMultiplicative() };
    }
    return l;
  }

  parseMultiplicative() {
    let l = this.parseUnary();
    while (this.check('OP') && ['*','/','%'].includes(this.peek().value)) {
      const op = this.advance().value; l = { type: 'BinOp', op, left: l, right: this.parseUnary() };
    }
    return l;
  }

  parseUnary() {
    if (this.check('OP', '-')) { this.advance(); return { type: 'UnOp', op: '-', operand: this.parseUnary() }; }
    return this.parsePrimary();
  }

  _parseBasePrimary() {
    const t = this.peek();
    if (t.type === 'NUMBER') { this.advance(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'STRING') { this.advance(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'CHAR')   { this.advance(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'KEYWORD' && t.value === 'sa7')   { this.advance(); return { type: 'Literal', value: true }; }
    if (t.type === 'KEYWORD' && t.value === 'ghalt') { this.advance(); return { type: 'Literal', value: false}; }
    if (t.type === 'LBRACK') {
      this.advance();
      const elements = [];
      while (!this.check('RBRACK') && !this.check('EOF')) { elements.push(this.parseExpr()); this.match('COMMA'); }
      this.expect('RBRACK');
      return { type: 'ArrayLiteral', elements };
    }
    if (t.type === 'IDENT') {
      this.advance();
      if (this.check('LPAREN')) {
        this.advance();
        const args = [];
        while (!this.check('RPAREN') && !this.check('EOF')) { args.push(this.parseExpr()); this.match('COMMA'); }
        this.expect('RPAREN');
        return { type: 'Call', callee: t.value, args };
      }
      return { type: 'Ident', name: t.value };
    }
    if (t.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpr();
      this.expect('RPAREN');
      return expr;
    }
    throw new SyntaxError(`Unexpected token: ${t.type}${t.value !== undefined ? ` "${t.value}"` : ''}`);
  }

  parsePrimary() {
    let expr = this._parseBasePrimary();
    while (true) {
      if (this.check('LBRACK')) {
        this.advance();
        const index = this.parseExpr();
        this.expect('RBRACK');
        expr = { type: 'Index', expr, index };
      } else if (this.match('OP', '++')) {
        if (expr.type !== 'Ident' && expr.type !== 'Index') throw new Error('Invalid increment target');
        if (expr.type === 'Index') {
          expr = { type: 'IndexAssign', expr: expr.expr, index: expr.index, value: { type: 'BinOp', op: '+', left: expr, right: { type: 'Literal', value: 1 } } };
        } else {
          expr = { type: 'Assign', name: expr.name, value: { type: 'BinOp', op: '+', left: expr, right: { type: 'Literal', value: 1 } } };
        }
      } else if (this.match('OP', '--')) {
        if (expr.type !== 'Ident' && expr.type !== 'Index') throw new Error('Invalid decrement target');
        if (expr.type === 'Index') {
          expr = { type: 'IndexAssign', expr: expr.expr, index: expr.index, value: { type: 'BinOp', op: '-', left: expr, right: { type: 'Literal', value: 1 } } };
        } else {
          expr = { type: 'Assign', name: expr.name, value: { type: 'BinOp', op: '-', left: expr, right: { type: 'Literal', value: 1 } } };
        }
      } else {
        break;
      }
    }
    return expr;
  }
}

// =============================================================================
// CHKOUPI INTERPRETER
// =============================================================================
const MAX_STEPS = 200_000;
class BreakSignal {}
class ContinueSignal {}
class ReturnSignal { constructor(v) { this.value = v; } }

class Env {
  constructor(parent = null) { this.vars = new Map(); this.consts = new Set(); this.parent = parent; }
  define(n, v, c = false) { this.vars.set(n, v); if (c) this.consts.add(n); }
  get(n) {
    if (this.vars.has(n)) return this.vars.get(n);
    if (this.parent) return this.parent.get(n);
    throw new Error(`'${n}' mkaynch — undefined variable`);
  }
  set(n, v) {
    if (this.vars.has(n)) {
      if (this.consts.has(n)) throw new Error(`'${n}' hiya dima — constant!`);
      this.vars.set(n, v); return;
    }
    if (this.parent) { this.parent.set(n, v); return; }
    throw new Error(`'${n}' mkaynch — undefined variable`);
  }
}

class ChkoupiInterpreter {
  constructor(outputCb, inputCb) {
    this.out   = outputCb ?? (() => {});
    this.inp   = inputCb ?? ((m) => window.prompt(m) ?? '');
    this.steps = 0;
    this.globals = new Env();
    this._builtins();
  }

  _builtins() {
    this.globals.define('ektb', (args) => {
      if (!args.length) return;
      const fmt = args[0];
      if (typeof fmt !== 'string') { this.out(String(fmt)); return; }
      let i = 1;
      const r = fmt.replace(/%lld|%ld|%d|%lf|%f|%s|%c/g, (spec) => {
        const v = args[i++];
        if (v === undefined) return spec;
        if (spec === '%lld' || spec === '%ld' || spec === '%d') return String(Math.trunc(Number(v)));
        if (spec === '%lf' || spec === '%f') return String(Number(v));
        return String(v);
      });
      this.out(r);
    });
    this.globals.define('a9ra', '__builtin__');
    this.globals.define('tool', (args) => {
      if (!args.length) return 0;
      const v = args[0];
      if (typeof v === 'string') return v.length;
      if (Array.isArray(v)) return v.length;
      return 0;
    });
    this.globals.define('jdr', (args) => {
      if (!args.length) return 0.0;
      return Math.sqrt(Number(args[0]));
    });
    this.globals.define('qwa', (args) => {
      if (args.length < 2) return 0.0;
      return Math.pow(Number(args[0]), Number(args[1]));
    });
  }

  run(ast) { this.steps = 0; this._list(ast.stmts, this.globals); }

  _tick() {
    if (++this.steps > MAX_STEPS)
      throw new Error(`Infinite loop? Reached ${MAX_STEPS.toLocaleString()} steps.`);
  }

  _list(stmts, env) {
    for (const s of stmts) {
      const r = this._exec(s, env);
      if (r instanceof ReturnSignal || r instanceof BreakSignal || r instanceof ContinueSignal) return r;
    }
  }

  _exec(stmt, env) {
    this._tick();
    switch (stmt.type) {
      case 'VarDecl':  { const v = this._eval(stmt.init, env); env.define(stmt.name, v, stmt.kind === 'dima'); return; }
      case 'ExprStmt': { this._eval(stmt.expr, env); return; }
      case 'If': {
        if (this._truthy(this._eval(stmt.cond, env))) return this._list(stmt.then.stmts, new Env(env));
        else if (stmt.else_) return this._list(stmt.else_.stmts, new Env(env));
        return;
      }
      case 'While': {
        while (this._truthy(this._eval(stmt.cond, env))) {
          this._tick();
          const r = this._list(stmt.body.stmts, new Env(env));
          if (r instanceof ReturnSignal) return r;
          if (r instanceof BreakSignal) break;
          if (r instanceof ContinueSignal) continue;
        }
        return;
      }
      case 'For': {
        const fe = new Env(env);
        if (stmt.init.type === 'VarDecl') fe.define(stmt.init.name, this._eval(stmt.init.init, fe), stmt.init.kind === 'dima');
        else this._eval(stmt.init.expr, fe);
        while (this._truthy(this._eval(stmt.cond, fe))) {
          this._tick();
          const r = this._list(stmt.body.stmts, new Env(fe));
          if (r instanceof ReturnSignal) return r;
          if (r instanceof BreakSignal) break;
          if (r instanceof ContinueSignal) {
            this._eval(stmt.update, fe);
            continue;
          }
          this._eval(stmt.update, fe);
        }
        return;
      }
      case 'Switch': {
        const v = this._eval(stmt.expr, env);
        for (const c of stmt.cases) {
          if (v === this._eval(c.val, env)) { const r = this._exec(c.stmt, new Env(env)); if (r instanceof ReturnSignal) return r; break; }
        }
        return;
      }
      case 'Try': {
        try { const r = this._list(stmt.body.stmts, new Env(env)); if (r instanceof ReturnSignal) return r; }
        catch(e) { if (e instanceof ReturnSignal) return e; const r = this._list(stmt.handler.stmts, new Env(env)); if (r instanceof ReturnSignal) return r; }
        return;
      }
      case 'FuncDecl': {
        const d = stmt;
        env.define(d.name, (args) => {
          const fe = new Env(this.globals);
          d.params.forEach((p, i) => fe.define(p.name, args[i] ?? null));
          const r = this._list(d.body.stmts, fe);
          return r instanceof ReturnSignal ? r.value : null;
        });
        return;
      }
      case 'Block':  return this._list(stmt.stmts, new Env(env));
      case 'Return': { const v = stmt.value ? this._eval(stmt.value, env) : null; return new ReturnSignal(v); }
      case 'Break':  return new BreakSignal();
      case 'Continue': return new ContinueSignal();
      case 'Import': return;
      default: throw new Error(`Unknown stmt: ${stmt.type}`);
    }
  }

  _eval(expr, env) {
    this._tick();
    switch (expr.type) {
      case 'Literal': return expr.value;
      case 'Ident':   return env.get(expr.name);
      case 'Assign':  { const v = this._eval(expr.value, env); env.set(expr.name, v); return v; }
      case 'ArrayLiteral': return expr.elements.map(el => this._eval(el, env));
      case 'Index': {
        const arr = this._eval(expr.expr, env);
        const idx = this._eval(expr.index, env);
        if (!Array.isArray(arr) && typeof arr !== 'string') throw new Error('subscript index dynamic array wla string b sa7');
        if (idx < 0 || idx >= arr.length) throw new Error('subscript out of bounds! index ' + idx + ' length ' + arr.length);
        return arr[idx];
      }
      case 'IndexAssign': {
        const arr = this._eval(expr.expr, env);
        const idx = this._eval(expr.index, env);
        const val = this._eval(expr.value, env);
        if (!Array.isArray(arr)) throw new Error('subscript assign dynamic array b sa7');
        if (idx < 0 || idx >= arr.length) throw new Error('subscript out of bounds! index ' + idx + ' length ' + arr.length);
        arr[idx] = val;
        return val;
      }
      case 'BinOp': {
        if (expr.op === 'w')   return this._truthy(this._eval(expr.left, env)) ? this._truthy(this._eval(expr.right, env)) : false;
        if (expr.op === 'wla') { if (this._truthy(this._eval(expr.left, env))) return true; return this._truthy(this._eval(expr.right, env)); }
        const l = this._eval(expr.left, env), r = this._eval(expr.right, env);
        switch (expr.op) {
          case '+':  return (typeof l === 'string' || typeof r === 'string') ? String(l)+String(r) : l+r;
          case '-':  return l - r;
          case '*':  return l * r;
          case '/':  if (r === 0) throw new Error('Qsma 3la sifr! (division by zero)');
                     return (Number.isInteger(l) && Number.isInteger(r)) ? Math.trunc(l/r) : l/r;
          case '%':  return l % r;
          case '==': return l === r;
          case '!=': return l !== r;
          case '<':  return l < r;
          case '>':  return l > r;
          case '<=': return l <= r;
          case '>=': return l >= r;
          default:   throw new Error(`Unknown op: ${expr.op}`);
        }
      }
      case 'UnOp': {
        const v = this._eval(expr.operand, env);
        if (expr.op === '-')     return -v;
        if (expr.op === 'machi') return !this._truthy(v);
        throw new Error(`Unknown unary: ${expr.op}`);
      }
      case 'Call': {
        if (expr.callee === 'a9ra') {
          const arg = expr.args[0];
          if (!arg || arg.type !== 'Ident') throw new Error('a9ra() needs a variable name');
          const cur = env.get(arg.name);
          const raw = this.inp(`3tini 9imt "${arg.name}":`);
          let pv;
          if (typeof cur === 'number' && Number.isInteger(cur)) { pv = parseInt(raw, 10); if (isNaN(pv)) pv = 0; }
          else if (typeof cur === 'number') { pv = parseFloat(raw); if (isNaN(pv)) pv = 0.0; }
          else pv = raw ?? '';
          env.set(arg.name, pv);
          return pv;
        }
        const fn = env.get(expr.callee);
        if (typeof fn !== 'function') throw new Error(`'${expr.callee}' machi function`);
        return fn(expr.args.map(a => this._eval(a, env)));
      }
      default: throw new Error(`Unknown expr: ${expr.type}`);
    }
  }

  _truthy(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number')  return v !== 0;
    return true;
  }
}

// =============================================================================
// CODEMIRROR SYNTAX HIGHLIGHTING
// =============================================================================
const chkoupiLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.match(/\/\/.*/)) return 'comment';
    if (stream.match(/\/\*[\s\S]*?\*\//)) return 'comment';
    if (stream.match(/"[^"]*"/)) return 'string';
    if (stream.match(/'[^']*'/)) return 'string';
    if (stream.match(/\b(dir|dima|idha|idha_mknch|ab9a_dor|dor|a7bss|kml|bdl|khyr|jarb|ila_ghalt|dalla|raja3|jibli|w|wla|machi)\b/)) return 'keyword';
    if (stream.match(/\b(tabi3i|3ouchri|5iyar|7arf|nass|fargh|jadwl)\b/)) return 'typeName';
    if (stream.match(/\b(sa7|ghalt)\b/)) return 'bool';
    if (stream.match(/\b(ektb|a9ra|tool)\b/)) return 'builtin';
    if (stream.match(/\b\d+(\.\d+)?\b/)) return 'number';
    if (stream.match(/->|==|!=|<=|>=|[+\-*/%<>]/)) return 'operator';
    stream.next();
    return null;
  }
});

// =============================================================================
// EDITOR
// =============================================================================
let editorView = null;
let _editorOriginalCode = ''; // tracks code loaded from "Try it" for reset

const editorTheme = EditorView.theme({
  '&': { backgroundColor: '#0a0a14', fontSize: '13px', fontFamily: "'JetBrains Mono', monospace" },
  '.cm-content': { padding: '16px', minHeight: '200px' },
  '.cm-line': { lineHeight: '1.7' },
  '.cm-gutters': { backgroundColor: '#0a0a14', borderRight: '1px solid rgba(255,255,255,0.07)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(0,168,84,0.08)' },
  '.cm-activeLine': { backgroundColor: 'rgba(0,168,84,0.05)' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(0,168,84,0.2)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(0,168,84,0.25)' },
  '.cm-cursor': { borderLeftColor: '#00a854', borderLeftWidth: '2px' },
  '.cm-scroller': { overflow: 'auto', height: '100%' },
});

function initEditor(code = '') {
  const pane = document.getElementById('editor-pane');
  const outputEl = document.getElementById('output-content');
  try {
    if (editorView) { editorView.destroy(); editorView = null; }
    const state = EditorState.create({
      doc: code,
      extensions: [basicSetup, chkoupiLanguage, oneDark, editorTheme, EditorView.lineWrapping],
    });
    editorView = new EditorView({ state, parent: pane });
    editorView.dispatch({});
  } catch (err) {
    outputEl.style.color = 'var(--dz-red-light)';
    outputEl.textContent = '❌ Editor init error: ' + err.message;
    console.error('initEditor failed:', err);
  }
}

// =============================================================================
// NAVIGATION
// =============================================================================
window.navigate = function(page) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo(0, 0);
};

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// =============================================================================
// COPY CODE
// =============================================================================
window.copyCode = async function(btn) {
  const block = btn.closest('.code-block');
  const codeEl = block ? block.querySelector('.code-content code') : null;
  const text = codeEl ? codeEl.textContent : '';
  try {
    await navigator.clipboard.writeText(text);
    btn.classList.add('copied');
    btn.textContent = '✅ Copied!';
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = '📋 Copy'; }, 1800);
  } catch { btn.textContent = 'Error'; }
};

// =============================================================================
// TRY IT YOURSELF
// =============================================================================
window.tryCode = function(btn) {
  const block = btn.closest('.code-block');
  const codeEl = block ? block.querySelector('.code-content code') : null;
  // Use textContent (not innerText) — works even if element is hidden
  const code = codeEl ? codeEl.textContent : '';
  openEditor(code);
};

function openEditor(code = '') {
  _editorOriginalCode = code;
  const overlay = document.getElementById('editor-overlay');
  overlay.classList.add('open');
  initEditor(code);
}

window.resetCode = function() {
  if (!editorView) return;
  initEditor(_editorOriginalCode);
  const outputEl = document.getElementById('output-content');
  outputEl.style.color = '';
  outputEl.textContent = '// Press ▶ Run to execute...';
};

window.closeEditor = function() {
  document.getElementById('editor-overlay').classList.remove('open');
};

// =============================================================================
// RUN CODE  (real interpreter)
// =============================================================================
window.runCode = function() {
  if (!editorView) return;
  const code = editorView.state.doc.toString().trim();
  const outputEl = document.getElementById('output-content');

  if (!code) {
    outputEl.style.color = 'var(--text-muted)';
    outputEl.textContent = '// kateb shi code l-awwel...';
    return;
  }

  let outBuffer = '';
  let _pendingPrompt = '';  // tracks text from ektb() before a9ra()
  const outputCb = (str) => {
    outBuffer += str;
    // If the last ektb output doesn't end with \n, treat it as a prompt for the next a9ra
    if (!str.endsWith('\n')) {
      _pendingPrompt = str;
    } else {
      _pendingPrompt = '';
    }
  };
  const inputCb  = (msg) => {
    // Use the pending prompt from ektb() if available, otherwise fall back to msg
    const promptText = _pendingPrompt || msg;
    const val = window.prompt(promptText);
    if (val !== null) outBuffer += `${val}\n`;
    _pendingPrompt = '';
    return val ?? '';
  };

  try {
    const tokens = tokenize(code);
    const ast    = new ChkoupiParser(tokens).parse();
    const interp = new ChkoupiInterpreter(outputCb, inputCb);
    interp.run(ast);
    outputEl.style.color = 'var(--dz-green-light)';
    outputEl.textContent  = outBuffer || '(no output)';
  } catch (err) {
    outputEl.style.color = 'var(--dz-red-light)';
    outputEl.textContent  = '❌ ' + err.message;
  }
};

// =============================================================================
// KEYBOARD SHORTCUTS
// =============================================================================
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const overlay = document.getElementById('editor-overlay');
    if (overlay && overlay.classList.contains('open')) {
      e.preventDefault();
      window.runCode();
    }
  }
  if (e.key === 'Escape') {
    const overlay = document.getElementById('editor-overlay');
    if (overlay && overlay.classList.contains('open')) {
      window.closeEditor();
    }
  }
});
