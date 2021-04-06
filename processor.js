// =============== JXML Preprocessor Library ===============

/**
 * @typedef {Object} LineColumn
 * @property {number} l - The line number.
 * @property {number} c - The column number.
 */

/**
 * Finds the line and column of a specific index. Used for error reporting.
 * @param  {string} s - The source string for searching the line and column in.
 * @param  {number} i - The character index of the specific line/column position.
 * @returns {LineColumn} lc - An object containing the line and column position of the index.
 */
 const lineCount = function (s, i) {
  let l = 0;
  let c = 0;
  for (let n = 0; n < i; n++) {
    c++;
    if (s[n] === '\n') {
      l++;
      c = 0;
    }
  }
  return {
    l,
    c
  };
};

/**
 * Writes an error message using a multiline string and its index to find line/column position.
 * @param  {string} m - The error message to write.
 * @param  {string} s - The source multiline string to reference.
 * @param  {string} i - The character index where the error occurred.
 */
const errorLine = function (m, s, i) {
  const {
    l,
    c
  } = lineCount(s, i);
  console.error(`${m} (line ${l}, col ${c})`);
};

/**
 * Captures an array of substrings that are enclosed in curly braces, inclusive of the braces.
 * @param  {string} s - The source string to search for substrings inside.
 */
const captureBraces = function (s) {
  let b = 0;
  let si = -1;
  let c = [];

  for (let i = 0; i < s.length; i++) {
    if (s[i] === "}") {
      b--;
      // Negative brace count means we have a closing brace without any opening before it.
      if (b < 0) {
        errorLine("Closing curly brace '}' was found without an open curly brace.", s, i);
        return;
      }

      // Closing to zero brace count means we've entered the outermost file layer again. We can capture here.
      if (b === 0) {
        c.push(s.substring(si, i + 1));
        startIndex = -1;
      }
    }
    if (s[i] === "{") {
      b++;
      // Brace count of 1 means we have entered from the file layer and want to start capturing.
      if (b === 1) {
        si = i;
      }
    }
  }

  // Positive brace count at the end of the string means that the last startIndex was left unclosed.
  if (b > 0) {
    errorLine("Opening curly brace '{' was found without a closing brace.", s, si);
    return;
  }

  return c;
};

/**
 * Removes the first/last curly braces from each item in an array of strings.
 * @param  {Array.<string>} a - An array of strings to remove curly braces from.
 */
const removeBraces = function (a) {
  return a.map(s => {
    let o = s;
    if (o[0] === "{")
      o = o.substring(1);
    if (o[o.length - 1] === "}")
      o = o.substring(0, o.length - 1);

    return o;
  });
};

/**
 * Removes trailing duplicates of strings from an array of strings.
 * @param  {Array.<string>} a - The source array of strings to remove from.
 */
const uniqueArray = function (a) {
  return a.filter((v, i) => a.indexOf(v) === i);
};

/**
 * Filters an array of strings to only include items that start with "_".
 * @param  {Array.<string>} a - The source array to filter from.
 */
const findParams = function (a) {
  return a.filter((v, i) => v.indexOf('_') === 0);
};

/**
 * Writes an array of strings that are executable lines of JS.
 * These are intended to be called with eval() to add variables to the current scope.
 * @param  {Array.<string>} pn - An array of parameter namespaces.
 * @param  {Array.<object>} pv - An array of parameter values.
 */
const createVarEvals = function (pn, pv) {
  let e = [];
  for (let i = 0; i < pn.length; i++) {
    if (pn[i] == null || typeof pn[i] !== "string")
      continue;

    if (pv[i] == null)
      pv[i] = "";

    if (typeof pv[i] !== "boolean" &&
      typeof pv[i] !== "number" &&
      typeof pv[i] !== "string")
      pv[i] = "";

    e.push(`var ${pn[i].toString()} = \`${pv[i].toString()}\`;`);
  }

  return e;
}

/**
 * Processes a template string using a set of parameter values.
 * @param  {string} t - The template string to process.
 * @param  {Array.<object>} pv - The parameter values to pass into the template.
 */
const replaceTemplate = function (t, pv) {
  // captured data with braces, without braces, and param names 
  // all the data we can derive directly from the template goes here.
  let cb = captureBraces(t);
  let ci = removeBraces(cb);
  let pn = findParams(uniqueArray(ci));

  // generate variables from our param names/values
  let ev = createVarEvals(pn, pv);
  for (let i = 0; i < ev.length; i++) {
    (1, eval)(ev[i]);
  }
  //ev.forEach(d => eval(d));

  // replace parts of the template, one by one.
  let output = t;
  for (let i = 0; i < cb.length; i++) {
    // if ci[i] starts with ! as the first char, it is saying DO NOT PRINT ME
    // if you detect a !, get rid of only the first ! and prevent printing
    let noPrint = false;
    if (ci[i][0] === '!') {
      noPrint = true;
      ci[i] = ci[i].substring(1, ci[i].length);
    }

    let v = (1, eval)(ci[i]);
    if (noPrint || v == null)
      v = "";
    
    output = output.replace(cb[i], v);
  }

  return output;
}

/**
 * Takes a JXML string and recursively processes it until expressions are fully evaluated.
 * @param  {string} s - A file's worth of JXML to process.
 */
const replaceString = function (s) {
  let last = "";
  let current = s;

  do {
    last = current;
    current = replaceTemplate(current, []);
  } while (last !== current);

  return current;
}

/**
 * Takes a JS library string and a JXML string and processes them.
 * @param  {string} js - A file's worth of JS library functions, often shared across JXML files.
 * @param  {string} jxml - A file's worth of JXML to transform.
 */
const processJxml = function (js, jxml) {
  try {
    Embed = EmbedHOF;
    StringEmbed = StringEmbedHOF;
    (1, eval)(js);
    return replaceString(jxml);
  } catch (err) {
    console.error(`Failed to process JXML: ${err}`);
    return null;
  }
}

// This is the shorthand for the most familiar type of Embed.
// This is intended to be used on blocks of code so it will trim whitespace.
// HOF that creates a function matching its use signature i.e. sampleEmbed(...args)
// (template string)
/**
 * The JS shorthand for those familiar with the DefineEmbed XML system.
 * This is intended to be used on blocks of code so it will trim external whitespace.
 * This is a HOF that creates a function matching its use signature i.e. sampleEmbed(...args)
 * @param  {string} t - Template string to create an Embed from.
 */
const EmbedHOF = function (t) {
  return (...args) => {
    return replaceTemplate(t.trim(), [...args]);
  }
};

// This is a shorthand for a new type of Embed that can be used to create verbatim strings.
// It will not trim any whitespace.
// HOF that creates a function matching its use signature i.e. sampleStringEmbed(...args)
// (template string)
/**
 * This is a shorthand for a new type of Embed that can be used to create verbatim strings.
 * This is intended to be used on inline strings so it will NOT trim any whitespace.
 * This is a HOF that creates a function matching its use signature i.e. sampleStringEmbed(...args)
 * @param  {string} t - Template string to create a StringEmbed from.
 */
const StringEmbedHOF = function (t) {
  return (...args) => {
    return replaceTemplate(t, [...args]);
  }
};

module.exports = {
  processJxml,
  EmbedHOF,
  StringEmbedHOF
};