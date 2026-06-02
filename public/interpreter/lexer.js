/**
 * Chkoupi-lang Lexer
 * Converts source code into a flat token array.
 * Handles digit-starting keywords: 3ouchri, 5iyar, 7arf
 */

const KEYWORDS = new Set([
  'dir', 'dima',
  'idha', 'idha_mknch',
  'ab9a_dor', 'dor',
  'a7bss', 'kml',
  'bdl', 'khyr',
  'jarb', 'ila_ghalt',
  'dalla', 'raja3',
  'jibli',
  'w', 'wla', 'machi',
  'sa7', 'ghalt',
  // Types
  'tabi3i', '3ouchri', '5iyar', '7arf', 'nass', 'fargh', 'jadwl',
]);

export function tokenize(source) {
  const tokens = [];
  let pos = 0;
  const len = source.length;

  function match(str) {
    if (source.startsWith(str, pos)) { pos += str.length; return true; }
    return false;
  }

  while (pos < len) {
    // Whitespace
    if (/\s/.test(source[pos])) { pos++; continue; }

    // Single-line comment
    if (match('//')) {
      while (pos < len && source[pos] !== '\n') pos++;
      continue;
    }

    // Multi-line comment
    if (match('/*')) {
      while (pos < len && !source.startsWith('*/', pos)) pos++;
      if (pos < len) pos += 2;
      continue;
    }

    // Two-char operators (must come before single-char)
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

    // Single-char punctuation / operators
    const ch = source[pos];
    if ('+-*/%<>'.includes(ch))  { pos++; tokens.push({ type: 'OP',    value: ch }); continue; }
    if (ch === '=')               { pos++; tokens.push({ type: 'ASSIGN'           }); continue; }
    if (ch === ':')               { pos++; tokens.push({ type: 'COLON'            }); continue; }
    if (ch === ';')               { pos++; tokens.push({ type: 'SEMI'             }); continue; }
    if (ch === ',')               { pos++; tokens.push({ type: 'COMMA'            }); continue; }
    if (ch === '(')               { pos++; tokens.push({ type: 'LPAREN'           }); continue; }
    if (ch === ')')               { pos++; tokens.push({ type: 'RPAREN'           }); continue; }
    if (ch === '{')               { pos++; tokens.push({ type: 'LBRACE'           }); continue; }
    if (ch === '}')               { pos++; tokens.push({ type: 'RBRACE'           }); continue; }
    if (ch === '[')               { pos++; tokens.push({ type: 'LBRACK'           }); continue; }
    if (ch === ']')               { pos++; tokens.push({ type: 'RBRACK'           }); continue; }

    // String literal
    if (ch === '"') {
      pos++;
      let str = '';
      while (pos < len && source[pos] !== '"') {
        if (source[pos] === '\\') {
          pos++;
          const esc = source[pos++] ?? '';
          switch (esc) {
            case 'n':  str += '\n'; break;
            case 't':  str += '\t'; break;
            case '\\': str += '\\'; break;
            case '"':  str += '"';  break;
            default:   str += esc;
          }
        } else {
          str += source[pos++];
        }
      }
      if (pos < len) pos++; // closing "
      tokens.push({ type: 'STRING', value: str });
      continue;
    }

    // Char literal
    if (ch === "'") {
      pos++;
      let c;
      if (source[pos] === '\\') {
        pos++;
        const esc = source[pos++] ?? '';
        switch (esc) {
          case 'n': c = '\n'; break;
          case 't': c = '\t'; break;
          default:  c = esc;
        }
      } else {
        c = source[pos++];
      }
      if (pos < len && source[pos] === "'") pos++; // closing '
      tokens.push({ type: 'CHAR', value: c });
      continue;
    }

    // Digit-starting tokens: numbers OR digit-prefixed keywords (3ouchri, 5iyar, 7arf)
    if (/\d/.test(ch)) {
      const start = pos;
      while (pos < len && /\d/.test(source[pos])) pos++;

      if (pos < len && source[pos] === '.' && pos + 1 < len && /\d/.test(source[pos + 1])) {
        // Float
        pos++;
        while (pos < len && /\d/.test(source[pos])) pos++;
        tokens.push({ type: 'NUMBER', value: parseFloat(source.slice(start, pos)) });
      } else if (pos < len && /[a-zA-Z_]/.test(source[pos])) {
        // Digit-starting identifier (e.g. 3ouchri)
        while (pos < len && /[a-zA-Z0-9_]/.test(source[pos])) pos++;
        const word = source.slice(start, pos);
        tokens.push({ type: KEYWORDS.has(word) ? 'KEYWORD' : 'IDENT', value: word });
      } else {
        // Integer
        tokens.push({ type: 'NUMBER', value: parseInt(source.slice(start, pos), 10) });
      }
      continue;
    }

    // Letter/underscore-starting identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      const start = pos;
      while (pos < len && /[a-zA-Z0-9_]/.test(source[pos])) pos++;
      const word = source.slice(start, pos);
      tokens.push({ type: KEYWORDS.has(word) ? 'KEYWORD' : 'IDENT', value: word });
      continue;
    }

    // Unknown character — skip
    pos++;
  }

  tokens.push({ type: 'EOF' });
  return tokens;
}
