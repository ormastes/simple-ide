/**
 * Math Expression Converter
 *
 * Converts Simple math block syntax to both LaTeX and Unicode previews.
 * The Unicode path is the shared "char-based" preview used by the native
 * VS Code source editor and the rich custom editor.
 */

/** Map of Greek letter names to LaTeX commands */
const GREEK_TO_LATEX: Record<string, string> = {
    alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta',
    epsilon: '\\epsilon', zeta: '\\zeta', eta: '\\eta', theta: '\\theta',
    iota: '\\iota', kappa: '\\kappa', lambda: '\\lambda', mu: '\\mu',
    nu: '\\nu', xi: '\\xi', pi: '\\pi', rho: '\\rho',
    sigma: '\\sigma', tau: '\\tau', upsilon: '\\upsilon', phi: '\\phi',
    chi: '\\chi', psi: '\\psi', omega: '\\omega',
    Gamma: '\\Gamma', Delta: '\\Delta', Theta: '\\Theta', Lambda: '\\Lambda',
    Xi: '\\Xi', Pi: '\\Pi', Sigma: '\\Sigma', Phi: '\\Phi',
    Psi: '\\Psi', Omega: '\\Omega',
};

/** Map of Greek letter names to Unicode characters */
const GREEK_TO_UNICODE: Record<string, string> = {
    alpha: '\u03B1', beta: '\u03B2', gamma: '\u03B3', delta: '\u03B4',
    epsilon: '\u03B5', zeta: '\u03B6', eta: '\u03B7', theta: '\u03B8',
    iota: '\u03B9', kappa: '\u03BA', lambda: '\u03BB', mu: '\u03BC',
    nu: '\u03BD', xi: '\u03BE', pi: '\u03C0', rho: '\u03C1',
    sigma: '\u03C3', tau: '\u03C4', upsilon: '\u03C5', phi: '\u03C6',
    chi: '\u03C7', psi: '\u03C8', omega: '\u03C9',
    Gamma: '\u0393', Delta: '\u0394', Theta: '\u0398', Lambda: '\u039B',
    Xi: '\u039E', Pi: '\u03A0', Sigma: '\u03A3', Phi: '\u03A6',
    Psi: '\u03A8', Omega: '\u03A9',
};

/** Superscript digit map */
const SUPERSCRIPT_DIGITS: Record<string, string> = {
    '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3',
    '4': '\u2074', '5': '\u2075', '6': '\u2076', '7': '\u2077',
    '8': '\u2078', '9': '\u2079', 'n': '\u207F', 'i': '\u2071',
};

/** Known math function names that get \cmd treatment in LaTeX */
const KNOWN_FUNCTIONS = new Set([
    'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'min', 'max', 'lim',
    'tanh', 'sinh', 'cosh', 'det', 'tr', 'dim', 'ker', 'sup', 'inf',
]);

function findMatchingParen(s: string, start: number): number {
    let depth = 1;
    for (let i = start + 1; i < s.length; i++) {
        if (s[i] === '(') {
            depth++;
        } else if (s[i] === ')') {
            depth--;
            if (depth === 0) {
                return i;
            }
        }
    }
    return -1;
}

function replaceBalancedCall(
    s: string,
    name: string,
    replacer: (args: string) => string,
): string {
    let result = '';
    let i = 0;
    while (i < s.length) {
        const idx = s.indexOf(name + '(', i);
        if (idx === -1) {
            result += s.slice(i);
            break;
        }
        if (idx > 0 && s[idx - 1] === '\\') {
            result += s.slice(i, idx + name.length);
            i = idx + name.length;
            continue;
        }
        if (idx > 0 && /\w/.test(s[idx - 1])) {
            result += s.slice(i, idx + name.length);
            i = idx + name.length;
            continue;
        }
        result += s.slice(i, idx);
        const openParen = idx + name.length;
        const closeParen = findMatchingParen(s, openParen);
        if (closeParen === -1) {
            result += s.slice(idx);
            break;
        }
        const args = s.slice(openParen + 1, closeParen);
        result += replacer(args);
        i = closeParen + 1;
    }
    return result;
}

function splitAtTopLevelComma(args: string): [string, string] {
    let depth = 0;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '(') {
            depth++;
        } else if (args[i] === ')') {
            depth--;
        } else if (args[i] === ',' && depth === 0) {
            return [args.slice(0, i).trim(), args.slice(i + 1).trim()];
        }
    }
    return [args.trim(), ''];
}

export function simpleToLatex(source: string): string {
    let result = source;

    result = replaceBalancedCall(result, 'frac', (args) => {
        const [a, b] = splitAtTopLevelComma(args);
        if (!b) {
            return `\\frac{${simpleToLatex(a)}}{}`;
        }
        return `\\frac{${simpleToLatex(a)}}{${simpleToLatex(b)}}`;
    });

    result = replaceBalancedCall(result, 'sqrt', (args) => {
        return `\\sqrt{${simpleToLatex(args)}}`;
    });

    result = replaceBalancedCall(result, 'sum', (args) => {
        const [expr, bounds] = splitAtTopLevelComma(args);
        const boundsMatch = bounds.match(/^(\w+)=(.+)\.\.(.+)$/);
        if (boundsMatch) {
            const [, v, lo, hi] = boundsMatch;
            return `\\sum_{${simpleToLatex(v)}=${simpleToLatex(lo)}}^{${simpleToLatex(hi)}} ${simpleToLatex(expr)}`;
        }
        return `\\sum ${simpleToLatex(expr)}`;
    });

    result = replaceBalancedCall(result, 'product', (args) => {
        const [expr, bounds] = splitAtTopLevelComma(args);
        const boundsMatch = bounds.match(/^(\w+)=(.+)\.\.(.+)$/);
        if (boundsMatch) {
            const [, v, lo, hi] = boundsMatch;
            return `\\prod_{${simpleToLatex(v)}=${simpleToLatex(lo)}}^{${simpleToLatex(hi)}} ${simpleToLatex(expr)}`;
        }
        return `\\prod ${simpleToLatex(expr)}`;
    });

    result = replaceBalancedCall(result, 'integral', (args) => {
        const [expr, bounds] = splitAtTopLevelComma(args);
        const boundsMatch = bounds.match(/^(\w+)=(.+)\.\.(.+)$/);
        if (boundsMatch) {
            const [, v, lo, hi] = boundsMatch;
            return `\\int_{${simpleToLatex(lo)}}^{${simpleToLatex(hi)}} ${simpleToLatex(expr)} \\, d${v}`;
        }
        return `\\int ${simpleToLatex(expr)}`;
    });

    result = replaceBalancedCall(result, 'exp', (args) => {
        return `\\exp\\left(${simpleToLatex(args)}\\right)`;
    });

    result = replaceBalancedCall(result, 'log', (args) => {
        return `\\log\\left(${simpleToLatex(args)}\\right)`;
    });

    result = replaceBalancedCall(result, 'ln', (args) => {
        return `\\ln\\left(${simpleToLatex(args)}\\right)`;
    });

    result = replaceBalancedCall(result, 'tanh', (args) => {
        return `\\tanh\\left(${simpleToLatex(args)}\\right)`;
    });

    result = replaceBalancedCall(result, 'hat', (args) => {
        return `\\hat{${simpleToLatex(args)}}`;
    });

    result = replaceBalancedCall(result, 'tilde', (args) => {
        return `\\tilde{${simpleToLatex(args)}}`;
    });

    result = replaceBalancedCall(result, 'bar', (args) => {
        return `\\bar{${simpleToLatex(args)}}`;
    });

    result = replaceBalancedCall(result, 'dot', (args) => {
        return `\\dot{${simpleToLatex(args)}}`;
    });

    result = replaceBalancedCall(result, 'abs', (args) => {
        return `\\left\\lvert ${simpleToLatex(args)} \\right\\rvert`;
    });

    result = replaceBalancedCall(result, 'norm', (args) => {
        return `\\left\\lVert ${simpleToLatex(args)} \\right\\rVert`;
    });

    result = replaceBalancedCall(result, 'expect', (args) => {
        return `\\mathbb{E}[${simpleToLatex(args)}]`;
    });

    result = replaceBalancedCall(result, 'bb', (args) => {
        return `\\mathbb{${args}}`;
    });

    result = replaceBalancedCall(result, 'cal', (args) => {
        return `\\mathcal{${args}}`;
    });

    result = replaceBalancedCall(result, 'dd', (args) => {
        const [f, x] = splitAtTopLevelComma(args);
        return `\\frac{\\partial ${simpleToLatex(f)}}{\\partial ${simpleToLatex(x)}}`;
    });

    result = replaceBalancedCall(result, 'softmax', (args) => {
        return `\\mathrm{softmax}\\left(${simpleToLatex(args)}\\right)`;
    });

    result = replaceBalancedCall(result, 'cases', (args) => {
        const rows = args.split(';').map((row) => {
            const [expr, cond] = splitAtTopLevelComma(row);
            if (cond) {
                const condTrimmed = cond.trim();
                if (condTrimmed === 'otherwise') {
                    return `${simpleToLatex(expr)} & \\text{otherwise}`;
                }
                return `${simpleToLatex(expr)} & \\text{if } ${simpleToLatex(condTrimmed)}`;
            }
            return simpleToLatex(expr);
        });
        return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
    });

    for (const fn of KNOWN_FUNCTIONS) {
        if (['log', 'ln', 'exp', 'tanh'].includes(fn)) {
            continue;
        }
        const regex = new RegExp(`(?<!\\\\)\\b${fn}\\b`, 'g');
        result = result.replace(regex, `\\${fn}`);
    }

    result = result.replace(/(?<!\\)\bargmax\b/g, '\\arg\\max');
    result = result.replace(/(?<!\\)\bargmin\b/g, '\\arg\\min');

    for (const [name, cmd] of Object.entries(GREEK_TO_LATEX)) {
        const regex = new RegExp(`(?<!\\\\)\\b${name}\\b`, 'g');
        result = result.replace(regex, cmd);
    }

    result = result.replace(/(?<!\\)\bpartial\b/g, '\\partial');
    result = result.replace(/(?<!\\)\bnabla\b/g, '\\nabla');
    result = result.replace(/(?<!\\)\binfinity\b/g, '\\infty');

    result = result.replace(/\bmid\b/g, '\\mid');
    result = result.replace(/\bsim\b/g, '\\sim');
    result = result.replace(/\bin\b/g, '\\in');
    result = result.replace(/\bforall\b/g, '\\forall');
    result = result.replace(/\bexists\b/g, '\\exists');
    result = result.replace(/\bto\b/g, '\\to');
    result = result.replace(/\bleq\b/g, '\\leq');
    result = result.replace(/\bgeq\b/g, '\\geq');
    result = result.replace(/\bneq\b/g, '\\neq');
    result = result.replace(/\bapprox\b/g, '\\approx');

    result = result.replace(/\^(\w{2,})/g, '^{$1}');
    result = result.replace(/(\w)\[([^\]]+)\]\[([^\]]+)\]/g, '$1_{$2,$3}');
    result = result.replace(/(\w|\})\[([^\]]+)\]/g, '$1_{$2}');
    result = result.replace(/(\w)'/g, '$1^{T}');

    result = result.replace(/\s*@\s*/g, ' ');
    result = result.replace(/\.\+/g, '\\oplus');
    result = result.replace(/\.\-/g, '\\ominus');
    result = result.replace(/\.\*/g, '\\odot');
    result = result.replace(/\.\//g, '\\oslash');
    result = result.replace(/\s*\*\s*/g, ' \\cdot ');

    return result;
}

export function simpleToUnicode(source: string): string {
    let result = source;

    result = replaceBalancedCall(result, 'frac', (args) => {
        const [a, b] = splitAtTopLevelComma(args);
        if (!b) {
            return `(${simpleToUnicode(a)})/()`;
        }
        return `(${simpleToUnicode(a)})/(${simpleToUnicode(b)})`;
    });

    result = replaceBalancedCall(result, 'sqrt', (args) => {
        return `\u221A(${simpleToUnicode(args)})`;
    });

    result = replaceBalancedCall(result, 'sum', (args) => {
        const [expr, bounds] = splitAtTopLevelComma(args);
        const boundsMatch = bounds.match(/^(\w+)=(.+)\.\.(.+)$/);
        if (boundsMatch) {
            const [, v, lo, hi] = boundsMatch;
            return `\u2211(${simpleToUnicode(v)}=${simpleToUnicode(lo)}..${simpleToUnicode(hi)}) ${simpleToUnicode(expr)}`;
        }
        return `\u2211 ${simpleToUnicode(expr)}`;
    });

    result = replaceBalancedCall(result, 'product', (args) => {
        const [expr, bounds] = splitAtTopLevelComma(args);
        const boundsMatch = bounds.match(/^(\w+)=(.+)\.\.(.+)$/);
        if (boundsMatch) {
            const [, v, lo, hi] = boundsMatch;
            return `\u220F(${simpleToUnicode(v)}=${simpleToUnicode(lo)}..${simpleToUnicode(hi)}) ${simpleToUnicode(expr)}`;
        }
        return `\u220F ${simpleToUnicode(expr)}`;
    });

    result = replaceBalancedCall(result, 'integral', (args) => {
        const [expr, bounds] = splitAtTopLevelComma(args);
        const boundsMatch = bounds.match(/^(\w+)=(.+)\.\.(.+)$/);
        if (boundsMatch) {
            const [, v, lo, hi] = boundsMatch;
            return `\u222B(${simpleToUnicode(v)}=${simpleToUnicode(lo)}..${simpleToUnicode(hi)}) ${simpleToUnicode(expr)}`;
        }
        return `\u222B ${simpleToUnicode(expr)}`;
    });

    for (const [name, ch] of Object.entries(GREEK_TO_UNICODE)) {
        const regex = new RegExp(`\\b${name}\\b`, 'g');
        result = result.replace(regex, ch);
    }

    result = result.replace(/\^(\d)/g, (_match, digit) => {
        return SUPERSCRIPT_DIGITS[digit] || `^${digit}`;
    });
    result = result.replace(/\^([ni])/g, (_match, ch) => {
        return SUPERSCRIPT_DIGITS[ch] || `^${ch}`;
    });

    result = result.replace(/\bsqrt\b/g, '\u221A');
    result = result.replace(/\s*\*\s*/g, '\u00B7');
    result = result.replace(/\s*@\s*/g, '\u2297');
    result = result.replace(/\.\+/g, '\u2295');
    result = result.replace(/\.\-/g, '\u2296');
    result = result.replace(/\.\*/g, '\u2299');
    result = result.replace(/\.\//g, '\u2298');
    result = result.replace(/\bpartial\b/g, '\u2202');
    result = result.replace(/\bnabla\b/g, '\u2207');
    result = result.replace(/\binfinity\b/g, '\u221E');
    result = result.replace(/\bto\b/g, '\u2192');
    result = result.replace(/\bleq\b/g, '\u2264');
    result = result.replace(/\bgeq\b/g, '\u2265');
    result = result.replace(/\bneq\b/g, '\u2260');
    result = result.replace(/\bapprox\b/g, '\u2248');
    result = result.replace(/\bmid\b/g, '|');
    result = result.replace(/\bsim\b/g, '~');
    result = result.replace(/\bin\b/g, '\u2208');
    result = result.replace(/\bforall\b/g, '\u2200');
    result = result.replace(/\bexists\b/g, '\u2203');

    return result;
}
