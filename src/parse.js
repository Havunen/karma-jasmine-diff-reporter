'use strict';

var Value = require('./value');
var MARKER = require('./marker').MARKER;

var stringUtils = require('./utils/string');
var endsWith = stringUtils.endsWith;

var ANY_PATTERN = /^<jasmine\.any\((.*)\)>$/;
var OBJECT_CONTAINING_PATTERN = /^<jasmine.objectContaining\((.*)\)>$/;
var ARRAY_CONTAINING_PATTERN = /^<jasmine.arrayContaining\((.*)\)>$/;


function isAnything(valueStr) {
  return valueStr === '<jasmine.anything>';
}

// jasmine.any works only with toEqual
// It can be used both as expected and actual value.
// It checks for String, Number, Function, Object, Boolean; other types are
// checked using instanceof.
// We need it only to remove possible highlight for matches of the same type.
// All instances can't be checked, so remove highlights only for popular ones.
function isAny(valueStr) {
  return !!valueStr.match(ANY_PATTERN);
}

function getAny(anyValueStr, options) {
  var map = {
    'String': Value.STRING,
    'Number': Value.NUMBER,
    'Function': Value.FUNCTION,
    'Object': Value.OBJECT,
    'Boolean': Value.BOOLEAN
  };

  var type = Value.INSTANCE;
  var match = anyValueStr.match(ANY_PATTERN);

  var valueStr = match && match[1];
  if (valueStr && map[valueStr]) {
    type = map[valueStr];
  }

  return new Value(type, valueStr, Object.assign({ any: true }, options))
}

function isObjectContaining(valueStr) {
  return !!valueStr.match(OBJECT_CONTAINING_PATTERN);
}

function getObjectContaining(containingValueStr, options) {
  var match = containingValueStr.match(OBJECT_CONTAINING_PATTERN);
  var valueStr = match && match[1];
  var value = parse(valueStr, Object.assign({ containing: true }, options));
  return value;
}

function isArrayContaining(valueStr) {
  return !!valueStr.match(ARRAY_CONTAINING_PATTERN);
}

function getArrayContaining(containingValueStr, options) {
  var match = containingValueStr.match(ARRAY_CONTAINING_PATTERN);
  var valueStr = match && match[1];
  var value = parse(valueStr, Object.assign({ containing: true }, options));
  return value;
}


function isUndefined(valueStr) {
  return valueStr === 'undefined';
}

function isNull(valueStr) {
  return valueStr === 'null';
}

function isBoolean(valueStr) {
  return valueStr === 'true' || valueStr === 'false';
}

function isString(valueStr) {
  var marker = MARKER + "'" + MARKER;
  return valueStr.indexOf(marker) === 0 &&
         valueStr.lastIndexOf(marker) === valueStr.length - 3;
}

// http://stackoverflow.com/a/9716488/1573638
function isNumber(valueStr) {
  return !isNaN(parseFloat(valueStr)) && isFinite(valueStr);
}

function isArray(valueStr) {
  return valueStr[0] === '[' && valueStr[valueStr.length - 1] === ']';
}

function isObject(valueStr) {
  return valueStr.indexOf('Object({') === 0 && valueStr.lastIndexOf('})') === valueStr.length - 2;
}

// TODO: check for correct identifier?
function isInstance(valueStr) {
  var index = valueStr.indexOf('({');
  var lastIndex = valueStr.lastIndexOf('})');

  return index > 0 && lastIndex === valueStr.length - 2;
}

function getInstance(valueStr) {
  var index = valueStr.indexOf('({');
  return valueStr.substr(0, index);
}

function extractValues(valueStr) {
  var value = '';
  var values = [];
  var nestLevel = 0;
  var inString = false;

  for (var i = 0; i < valueStr.length; i++) {
    var ch = valueStr[i];

    // Detect if current character represents the beginning/end of the string
    // So we could know later if we are inside a string

    // For Jasmine output strings are wrapped in single quotes and markers:
    // <marker><single quote><marker><string></marker></single quote></marker>
    if (ch === MARKER && endsWith(value, MARKER + "'")) {

      inString = !inString;

    } else if (!inString) {

      if (ch === '[' || ch === '{') {
        nestLevel++;
        value += ch;
        continue;
      }

      if (ch === ']' || ch === '}') {
        nestLevel--;
        value += ch;
        continue;
      }

      if (ch === ' ' && nestLevel === 0) {
        continue;
      }

      if (ch === ',' && nestLevel === 0) {
        values.push(value.trim());
        value = '';
        continue;
      }

    }

    value += ch;
  }

  values.push(value.trim());

  return values;
}

function extractKeyValue(objectValueStr) {
  var semiIndex = objectValueStr.indexOf(':');
  return {
    key: objectValueStr.substr(0, semiIndex).trim(),
    value: objectValueStr.substr(semiIndex + 1, objectValueStr.length - 1).trim()
  };
}

function extractArrayValues(arrayStr) {
  // cut [...]
  var arrayContentStr = arrayStr.substr(1, arrayStr.length - 2);
  var arrayValues = extractValues(arrayContentStr);
  return arrayValues;
}

function extractObjectValues(objectStr) {
  // cut Object({...})
  var objectContentStr = objectStr.substr(8, objectStr.length - 3 - 8);
  var objectValues = extractValues(objectContentStr);

  var objectKeyValues = [];
  for (var i = 0; i < objectValues.length; i++) {
    objectKeyValues.push(extractKeyValue(objectValues[i]));
  }

  return objectKeyValues;
}

function extractInstanceValues(instanceStr) {
  // cut Inst({...})
  var index = instanceStr.indexOf('({');
  var instanceContentStr = instanceStr.substr(index + 3, instanceStr.length - index - 3 - 2);

  var instanceValues = extractValues(instanceContentStr);

  var instanceKeyValues = [];
  for (var i = 0; i < instanceValues.length; i++) {
    instanceKeyValues.push(extractKeyValue(instanceValues[i]));
  }

  return instanceKeyValues;
}

function isFunction(valueStr) {
  return valueStr === 'Function';
}

function isNode(valueStr) {
  return valueStr === 'HTMLNode';
}

function isGlobal(valueStr) {
  return valueStr === '<global>';
}

function isCircularReference(valueStr) {
  return !!valueStr.match(/^<circular reference: (Array|Object)>$/);
}

// Occurs in arrays when array length is bigger than MAX_PRETTY_PRINT_ARRAY_LENGTH
function isEllipsis(valueStr) {
  return valueStr === '...';
}

function isSpy(valueStr) {
  return !!valueStr.match(/^spy on/);
}


function parse(valueStr, options) {
  valueStr = valueStr.trim();

  // Check Jasmine wrappers

  if (isAnything(valueStr)) {
    return new Value(Value.ANYTHING, valueStr, options);
  }

  if (isAny(valueStr)) {
    return getAny(valueStr, options);
  }

  if (isObjectContaining(valueStr)) {
    return getObjectContaining(valueStr, options);
  }

  if (isArrayContaining(valueStr)) {
    return getArrayContaining(valueStr, options);
  }

  // Check basic types

  if (isUndefined(valueStr)) {
    return new Value(Value.UNDEFINED, valueStr, options);
  }

  if (isNull(valueStr)) {
    return new Value(Value.NULL, valueStr, options);
  }

  if (isBoolean(valueStr)) {
    return new Value(Value.BOOLEAN, valueStr, options);
  }

  if (isString(valueStr)) {
    return new Value(Value.STRING, valueStr, options);
  }

  if (isNumber(valueStr)) {
    return new Value(Value.NUMBER, valueStr, options);
  }

  // Check complex types, can nest

  if (isArray(valueStr)) {
    var arrayValues = extractArrayValues(valueStr, options);
    var children = [];
    for (var i = 0; i < arrayValues.length; i++) {
      var arrayKey = i;
      var arrayValue = arrayValues[i];
      children.push(parse(arrayValue, {
        key: arrayKey
      }));
    }
    return new Value(Value.ARRAY, valueStr, Object.assign({
      children: children
    }, options));
  }

  if (isObject(valueStr)) {
    var objectValues = extractObjectValues(valueStr);
    var children = [];
    for (var i = 0; i < objectValues.length; i++) {
      var objectKey = objectValues[i].key;
      var objectValue = objectValues[i].value;
      children.push(parse(objectValue, {
        key: objectKey
      }));
    }
    return new Value(Value.OBJECT, valueStr, Object.assign({
      children: children
    }, options));
  }

  if (isInstance(valueStr)) {
    var instanceValues = extractInstanceValues(valueStr);
    var children = [];
    for (var i = 0; i < instanceValues.length; i++) {
      var instanceKey = instanceValues[i].key;
      var instanceValue = instanceValues[i].value;
      children.push(parse(instanceValue, {
        key: instanceKey
      }));
    }
    return new Value(Value.INSTANCE, valueStr, Object.assign({
      children: children,
      instance: getInstance(valueStr)
    }, options));
  }

  // Check complex types, can NOT nest

  if (isFunction(valueStr)) {
    return new Value(Value.FUNCTION, valueStr, options);
  }

  if (isGlobal(valueStr)) {
    return new Value(Value.GLOBAL, valueStr, options);
  }

  if (isNode(valueStr)) {
    return new Value(Value.NODE, valueStr, options);
  }

  if (isCircularReference(valueStr)) {
    return new Value(Value.CIRCULAR_REFERENCE, valueStr, options);
  }

  return new Value(Value.PRIMITIVE, valueStr, options);
}

module.exports = parse;
