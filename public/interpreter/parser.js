/**
 * Chkoupi-lang Parser
 * Recursive-descent parser that produces an AST from a token stream.
 *
 * AST node types:
 *   Program, Block, VarDecl, Assign, If, While, For, Switch, Try,
 *   FuncDecl, Return, Import, ExprStmt,
 *   BinOp, UnOp, Literal, Ident, Call
 */

export class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  // ── Token helpers ──────────────────────────────────────────────────────────

  peek()  { return this.tokens[this.pos]; }
  advance() { return this.tokens[this.pos++]; }

  check(type, value) {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }

  match(type, value) {
    if (this.check(type, value)) { this.advance(); return true; }
    return false;
  }

  expect(type, value) {
    const t = this.advance();
    if (t.type !== type) {
      throw new Error(
        `Syntax error: expected ${type}${value ? ` "${value}"` : ''}, got ${t.type}${t.value !== undefined ? ` "${t.value}"` : ''}`
      );
    }
    if (value !== undefined && t.value !== value) {
      throw new Error(`Syntax error: expected "${value}", got "${t.value}"`);
    }
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

  // ── Top-level ──────────────────────────────────────────────────────────────

  parse() {
    const stmts = [];
    while (!this.check('EOF')) {
      stmts.push(this.parseStatement());
    }
    return { type: 'Program', stmts };
  }

  parseBlock() {
    this.expect('LBRACE');
    const stmts = [];
    while (!this.check('RBRACE') && !this.check('EOF')) {
      stmts.push(this.parseStatement());
    }
    this.expect('RBRACE');
    return { type: 'Block', stmts };
  }

  // ── Statements ─────────────────────────────────────────────────────────────

  parseStatement() {
    const t = this.peek();
    if (t.type === 'KEYWORD') {
      switch (t.value) {
        case 'dalla':      return this.parseFuncDecl();
        case 'dir':
        case 'dima':       return this.parseVarDecl();
        case 'idha':       return this.parseIf();
        case 'ab9a_dor':   return this.parseWhile();
        case 'dor':        return this.parseFor();
        case 'bdl':        return this.parseSwitch();
        case 'jarb':       return this.parseTry();
        case 'raja3':      return this.parseReturn();
        case 'jibli':      return this.parseImport();
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
      const paramName = this.expect('IDENT').value;
      this.expect('COLON');
      const paramType = this.parseType();
      params.push({ name: paramName, type: paramType });
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
    const kind = this.advance().value; // 'dir' or 'dima'
    const name = this.expect('IDENT').value;
    let typeAnnot = null;
    if (this.match('COLON')) {
      typeAnnot = this.parseType();
    }
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
      else_ = this.parseBlock();
    }
    return { type: 'If', cond, then, else_ };
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

    // Init: var decl or expression
    let init = null;
    const t = this.peek();
    if (t.type === 'KEYWORD' && (t.value === 'dir' || t.value === 'dima')) {
      const kind = this.advance().value;
      const name = this.expect('IDENT').value;
      let typeAnnot = null;
      if (this.match('COLON')) typeAnnot = this.parseType();
      this.expect('ASSIGN');
      const initVal = this.parseExpr();
      init = { type: 'VarDecl', kind, name, typeAnnot, init: initVal };
    } else {
      init = { type: 'ExprStmt', expr: this.parseExpr() };
    }
    this.expect('SEMI');

    const cond = this.parseExpr();
    this.expect('SEMI');
    const update = this.parseExpr(); // e.g. i = i + 1
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
      const stmt = this.parseStatement();
      cases.push({ val, stmt });
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
    if (!this.check('SEMI') && !this.check('RBRACE') && !this.check('EOF')) {
      value = this.parseExpr();
    }
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

  // ── Expressions (Pratt-style precedence climbing) ──────────────────────────

  parseExpr() { return this.parseAssignment(); }

  parseAssignment() {
    const left = this.parseLogicalOr();
    if (this.check('ASSIGN')) {
      this.advance();
      const right = this.parseAssignment();
      if (left.type !== 'Ident' && left.type !== 'Index') throw new Error('Invalid assignment target');
      if (left.type === 'Index') {
        return { type: 'IndexAssign', expr: left.expr, index: left.index, value: right };
      }
      return { type: 'Assign', name: left.name, value: right };
    }
    return left;
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    while (this.check('KEYWORD', 'wla')) {
      this.advance();
      const right = this.parseLogicalAnd();
      left = { type: 'BinOp', op: 'wla', left, right };
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseUnaryNot();
    while (this.check('KEYWORD', 'w')) {
      this.advance();
      const right = this.parseUnaryNot();
      left = { type: 'BinOp', op: 'w', left, right };
    }
    return left;
  }

  parseUnaryNot() {
    if (this.check('KEYWORD', 'machi')) {
      this.advance();
      return { type: 'UnOp', op: 'machi', operand: this.parseUnaryNot() };
    }
    return this.parseComparison();
  }

  parseComparison() {
    let left = this.parseAdditive();
    const cmpOps = ['==', '!=', '<', '>', '<=', '>='];
    while (this.check('OP') && cmpOps.includes(this.peek().value)) {
      const op = this.advance().value;
      left = { type: 'BinOp', op, left, right: this.parseAdditive() };
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.check('OP') && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.advance().value;
      left = { type: 'BinOp', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.check('OP') && ['*', '/', '%'].includes(this.peek().value)) {
      const op = this.advance().value;
      left = { type: 'BinOp', op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary() {
    if (this.check('OP', '-')) {
      this.advance();
      return { type: 'UnOp', op: '-', operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  _parseBasePrimary() {
    const t = this.peek();

    if (t.type === 'NUMBER') { this.advance(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'STRING') { this.advance(); return { type: 'Literal', value: t.value }; }
    if (t.type === 'CHAR')   { this.advance(); return { type: 'Literal', value: t.value }; }

    if (t.type === 'KEYWORD' && t.value === 'sa7')   { this.advance(); return { type: 'Literal', value: true }; }
    if (t.type === 'KEYWORD' && t.value === 'ghalt') { this.advance(); return { type: 'Literal', value: false }; }

    if (t.type === 'LBRACK') {
      this.advance();
      const elements = [];
      while (!this.check('RBRACK') && !this.check('EOF')) {
        elements.push(this.parseExpr());
        this.match('COMMA');
      }
      this.expect('RBRACK');
      return { type: 'ArrayLiteral', elements };
    }

    if (t.type === 'IDENT') {
      this.advance();
      if (this.check('LPAREN')) {  // function call
        this.advance();
        const args = [];
        while (!this.check('RPAREN') && !this.check('EOF')) {
          args.push(this.parseExpr());
          this.match('COMMA');
        }
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

    throw new Error(
      `Syntax error: unexpected token ${t.type}${t.value !== undefined ? ` "${t.value}"` : ''}`
    );
  }

  parsePrimary() {
    let expr = this._parseBasePrimary();
    while (true) {
      if (this.check('LBRACK')) {
        this.advance();
        const index = this.parseExpr();
        this.expect('RBRACK');
        expr = { type: 'Index', expr, index };
      } else {
        break;
      }
    }
    return expr;
  }
}
