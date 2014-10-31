(function() {
  var BibtexParser, isNumeric, safelyJoinArrayElements, toNumber, _;

  _ = require('underscore-plus');

  toNumber = function(value) {
    return value * 1;
  };

  isNumeric = function(value) {
    return !_.isBoolean(value) && !_.isNaN(toNumber(value));
  };

  safelyJoinArrayElements = function(array, separator) {
    if (array.length > 1) {
      return array.join(separator);
    } else {
      return array[0];
    }
  };

  module.exports = BibtexParser = (function() {
    function BibtexParser(bibtex) {
      this.bibtex = bibtex;
      this.strings = {
        jan: 'January',
        feb: 'February',
        mar: 'March',
        apr: 'April',
        may: 'May',
        jun: 'June',
        jul: 'July',
        aug: 'August',
        sep: 'September',
        oct: 'October',
        nov: 'November',
        dec: 'December'
      };
      this.entries = [];
      return;
    }

    BibtexParser.prototype.parse = function() {
      var bibtexEntries, entry, entryBody, entryType, _i, _len, _ref;
      bibtexEntries = this.findEntries();
      for (_i = 0, _len = bibtexEntries.length; _i < _len; _i++) {
        entry = bibtexEntries[_i];
        _ref = _.invoke(entry, 'trim'), entryType = _ref[0], entryBody = _ref[1];
        if (!entryType) {
          continue;
        }
        entry = (function() {
          switch (entryType.toLowerCase()) {
            case 'string':
              return this.stringEntry(entryBody);
            case 'preamble':
              return this.preambleEntry(entryBody);
            case 'comment':
              return this.commentEntry(entryBody);
            default:
              return this.keyedEntry(entryType, entryBody);
          }
        }).call(this);
        if (entry) {
          this.entries.push(entry);
        }
      }
      return this.entries;
    };

    BibtexParser.prototype.findEntries = function() {
      var delimitingAts, delimitingCharacter, endOfBody, entries, entryPattern, informalCommentEntry, lastDelimitingAt, lengthOfBody, match, nextDelimitingAt, possibleBody, startOfBody, startOfEntry, _i, _len;
      delimitingAts = [];
      entryPattern = /@[^@\(\)\{\}]*[\(\{]/gi;
      while ((match = entryPattern.exec(this.bibtex)) != null) {
        delimitingAts.push([match.index, entryPattern.lastIndex - 1]);
      }
      if (!delimitingAts.length) {
        return [];
      }
      entries = [];
      lastDelimitingAt = delimitingAts[0];
      delimitingAts = delimitingAts.slice(1).concat([this.bibtex.length]);
      informalCommentEntry = this.informalCommentEntry(this.bibtex.slice(0, lastDelimitingAt[0]));
      if (informalCommentEntry) {
        entries.push(informalCommentEntry);
      }
      for (_i = 0, _len = delimitingAts.length; _i < _len; _i++) {
        nextDelimitingAt = delimitingAts[_i];
        startOfEntry = lastDelimitingAt[0], startOfBody = lastDelimitingAt[1];
        possibleBody = this.bibtex.slice(startOfBody, nextDelimitingAt[0]);
        delimitingCharacter = possibleBody[0];
        lastDelimitingAt = nextDelimitingAt;
        switch (delimitingCharacter) {
          case '{':
            lengthOfBody = this.nextDelimitingBracket(possibleBody.slice(1));
            break;
          case '(':
            lengthOfBody = this.nextDelimitingParenthesis(possibleBody.slice(1));
        }
        if ((lengthOfBody == null) || lengthOfBody === -1) {
          endOfBody = possibleBody.length;
        } else {
          endOfBody = lengthOfBody + 1;
        }
        entries.push([this.bibtex.slice(startOfEntry + 1, startOfBody), possibleBody.slice(1, endOfBody)]);
        informalCommentEntry = this.informalCommentEntry(possibleBody.slice(endOfBody + 1));
        if (informalCommentEntry) {
          entries.push(informalCommentEntry);
        }
      }
      return entries;
    };

    BibtexParser.prototype.stringEntry = function(entryBody) {
      var key, value, _ref;
      _ref = _.map(entryBody.split('='), function(s) {
        return s.replace(/^(?:\s*"?)+|(?:"?\s*)+$/g, '');
      }), key = _ref[0], value = _ref[1];
      this.strings[key] = value;
      return false;
    };

    BibtexParser.prototype.preambleEntry = function(entryBody) {
      var entry;
      return entry = {
        entryType: 'preamble',
        entry: safelyJoinArrayElements(this.splitValueByDelimiters(entryBody), '')
      };
    };

    BibtexParser.prototype.commentEntry = function(entryBody) {
      var entry;
      return entry = {
        entryType: 'comment',
        entry: entryBody
      };
    };

    BibtexParser.prototype.informalCommentEntry = function(possibleEntryBody) {
      var entry;
      possibleEntryBody = possibleEntryBody.trim();
      if (possibleEntryBody.length === 0 || possibleEntryBody[0] === '@') {
        return false;
      }
      return entry = {
        entryType: 'comment',
        entry: possibleEntryBody
      };
    };

    BibtexParser.prototype.keyedEntry = function(key, body) {
      var entry, field, fields, value, _i, _len, _ref;
      entry = {
        entryType: key.toLowerCase(),
        citationKey: '',
        entryTags: {}
      };
      fields = this.findFieldsInEntryBody(body);
      entry.citationKey = fields.shift();
      for (_i = 0, _len = fields.length; _i < _len; _i++) {
        field = fields[_i];
        _ref = _.invoke(this.splitKeyAndValue(field), 'trim'), key = _ref[0], value = _ref[1];
        if (value) {
          entry.entryTags[key] = safelyJoinArrayElements(this.splitValueByDelimiters(value), '');
        }
      }
      return entry;
    };

    BibtexParser.prototype.findFieldsInEntryBody = function(body) {
      var commas, delimitingCommas, fields, lastDelimitingComma, position, _i, _j, _len, _len1;
      commas = [];
      position = 0;
      while ((position = body.indexOf(',', position)) !== -1) {
        commas.push(position);
        position++;
      }
      delimitingCommas = [];
      lastDelimitingComma = 0;
      for (_i = 0, _len = commas.length; _i < _len; _i++) {
        position = commas[_i];
        if (this.areStringDelimitersBalanced(body.slice(lastDelimitingComma, position))) {
          delimitingCommas.push(lastDelimitingComma = position);
        }
      }
      delimitingCommas.push(body.length);
      fields = [];
      lastDelimitingComma = 0;
      for (_j = 0, _len1 = delimitingCommas.length; _j < _len1; _j++) {
        position = delimitingCommas[_j];
        fields.push(body.slice(lastDelimitingComma, position));
        lastDelimitingComma = position + 1;
      }
      return fields;
    };

    BibtexParser.prototype.isEscapedWithBackslash = function(text, position) {
      var slashes;
      slashes = 0;
      position--;
      while (text[position] === '\\') {
        slashes++;
        position--;
      }
      return slashes % 2 === 1;
    };

    BibtexParser.prototype.isEscapedWithBrackets = function(text, position) {
      return text[position - 1] === '{' && this.isEscapedWithBackslash(text, position - 1) && text[position + 1] === '}' && this.isEscapedWithBackslash(text, position + 1);
    };

    BibtexParser.prototype.splitKeyAndValue = function(text) {
      var position;
      if ((position = text.indexOf('=')) !== -1) {
        return [text.slice(0, position), text.slice(position + 1)];
      } else {
        return [text];
      }
    };

    BibtexParser.prototype.splitValueByDelimiters = function(text) {
      var delimiter, position, split, string, stringPattern, value;
      text = text.trim();
      if (isNumeric(text)) {
        return [toNumber(text)];
      }
      split = [];
      delimiter = text[0];
      position = 0;
      value = '';
      switch (delimiter) {
        case '"':
          position = toNumber(this.nextDelimitingQuotationMark(text.slice(1))) + 1;
          value = text.slice(1, position);
          break;
        case '{':
          position = toNumber(this.nextDelimitingBracket(text.slice(1))) + 1;
          value = text.slice(1, position);
          break;
        case '#':
          position = 1;
          break;
        default:
          stringPattern = /^[a-z][a-z_0-9]*/gi;
          stringPattern.exec(text);
          position = stringPattern.lastIndex;
          string = text.slice(0, position);
          if (this.strings[string] != null) {
            value = this.strings[string];
          }
      }
      if (!position) {
        return [text];
      }
      if (value) {
        value = isNumeric(value) ? value = toNumber(value) : value;
        split.push(value);
      }
      if (position < text.length - 1) {
        split = split.concat(this.splitValueByDelimiters(text.slice(position + 1)));
      }
      return split;
    };

    BibtexParser.prototype.nextDelimitingQuotationMark = function(text) {
      var position;
      position = text.indexOf('"');
      while (this.isEscapedWithBrackets(text, position)) {
        position = text.indexOf('"', position + 1);
      }
      return position;
    };

    BibtexParser.prototype.nextDelimitingBracket = function(text) {
      var character, numberOfOpenBrackets, position;
      numberOfOpenBrackets = 1;
      for (position in text) {
        character = text[position];
        position = toNumber(position);
        if (character === '{' && !this.isEscapedWithBackslash(text, position)) {
          numberOfOpenBrackets++;
        } else if (character === '}' && !this.isEscapedWithBackslash(text, position)) {
          numberOfOpenBrackets--;
        }
        if (numberOfOpenBrackets === 0) {
          return position;
        }
      }
      return -1;
    };

    BibtexParser.prototype.nextDelimitingParenthesis = function(text) {
      var character, numberOfOpenParentheses, position;
      numberOfOpenParentheses = 1;
      for (position in text) {
        character = text[position];
        position = toNumber(position);
        if (character === '(' && !this.isEscapedWithBackslash(text, position)) {
          numberOfOpenParentheses++;
        } else if (character === ')' && !this.isEscapedWithBackslash(text, position)) {
          numberOfOpenParentheses--;
        }
        if (numberOfOpenParentheses === 0) {
          return position;
        }
      }
      return -1;
    };

    BibtexParser.prototype.areStringDelimitersBalanced = function(text) {
      var character, numberOfOpenBrackets, numberOfQuotationMarks, position;
      numberOfOpenBrackets = 0;
      numberOfQuotationMarks = 0;
      for (position in text) {
        character = text[position];
        position = toNumber(position);
        if (character === '{' && !this.isEscapedWithBackslash(text, position)) {
          numberOfOpenBrackets++;
        } else if (character === '}' && !this.isEscapedWithBackslash(text, position)) {
          numberOfOpenBrackets--;
        } else if (character === '"' && !this.isEscapedWithBrackets(text, position)) {
          numberOfQuotationMarks++;
        }
      }
      return numberOfOpenBrackets === 0 && numberOfQuotationMarks % 2 === 0;
    };

    return BibtexParser;

  })();

}).call(this);