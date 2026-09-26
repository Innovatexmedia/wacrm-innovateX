// Minimal syntax highlighter for docs code blocks (json, js, bash/curl).
// Regex tokenizer — no dependencies. Unknown languages render as plain.

export type TokenType = 'plain' | 'str' | 'num' | 'kw' | 'com' | 'key' | 'flag' | 'var';
export interface Token {
  type: TokenType;
  v: string;
}

type Rule = [RegExp, TokenType];

const JSON_RULES: Rule[] = [
  [/\/\/[^\n]*|\/\*[\s\S]*?\*\//y, 'com'],
  [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, 'key'],
  [/"(?:[^"\\\n]|\\.)*"/y, 'str'],
  [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, 'num'],
  [/\b(?:true|false|null)\b/y, 'kw'],
];

const JS_KEYWORDS =
  'const|let|var|await|async|function|return|if|else|new|import|from|export|try|catch|throw|true|false|null|undefined';
const JS_RULES: Rule[] = [
  [/\/\/[^\n]*|\/\*[\s\S]*?\*\//y, 'com'],
  [/`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y, 'str'],
  [/\d+(?:\.\d+)?/y, 'num'],
  [new RegExp(`\\b(?:${JS_KEYWORDS})\\b`, 'y'), 'kw'],
];

const SH_RULES: Rule[] = [
  [/#[^\n]*/y, 'com'],
  [/"(?:[^"\\]|\\.)*"|'[^']*'/y, 'str'],
  [/(?<=\s)--?[A-Za-z][\w-]*/y, 'flag'],
  [/\$\{?\w+\}?/y, 'var'],
  [/\b(?:curl|npm|node|export|echo)\b/y, 'kw'],
];

function rulesFor(lang: string): Rule[] | null {
  switch (lang.toLowerCase()) {
    case 'json':
    case 'jsonc':
      return JSON_RULES;
    case 'js':
    case 'javascript':
    case 'ts':
    case 'typescript':
    case 'node':
      return JS_RULES;
    case 'bash':
    case 'sh':
    case 'shell':
    case 'curl':
      return SH_RULES;
    default:
      return null;
  }
}

export function highlight(code: string, lang: string): Token[] {
  const rules = rulesFor(lang);
  if (!rules) return [{ type: 'plain', v: code }];

  const tokens: Token[] = [];
  let plain = '';
  let i = 0;
  const flush = () => {
    if (plain) tokens.push({ type: 'plain', v: plain });
    plain = '';
  };
  while (i < code.length) {
    let matched = false;
    for (const [re, type] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m[0].length > 0) {
        flush();
        tokens.push({ type, v: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      plain += code[i];
      i++;
    }
  }
  flush();
  return tokens;
}