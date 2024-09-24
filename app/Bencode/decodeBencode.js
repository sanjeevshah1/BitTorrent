"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeBencode = decodeBencode;
var integerPrefix = 'i';
var stringDelimiter = ':';
var listPrefix = 'l';
var dictionaryPrefix = 'd';
var endSuffix = 'e';
function decodeBencode(bencodedValue) {
    if (bencodedValue[0] === integerPrefix) {
        return decodeInteger(bencodedValue);
    }
    else if (!isNaN(parseInt(bencodedValue[0]))) {
        return decodeString(bencodedValue);
    }
    else if (bencodedValue[0] === listPrefix) {
        return decodeList(bencodedValue);
    }
    else if (bencodedValue[0] === dictionaryPrefix) {
        return decodeDictionary(bencodedValue);
    }
    else {
        throw new Error("Unsupported bencoded value");
    }
}
function decodeInteger(bencodedValue) {
    var firstDigitIndex = 1;
    var lastDigitIndex = bencodedValue.indexOf(endSuffix);
    if (lastDigitIndex === -1) {
        throw new Error("Invalid integer encoding");
    }
    return parseInt(bencodedValue.substring(firstDigitIndex, lastDigitIndex));
}
function decodeString(bencodedValue) {
    var firstColonIndex = bencodedValue.indexOf(stringDelimiter);
    if (firstColonIndex === -1) {
        throw new Error("Invalid string encoding");
    }
    var length = parseInt(bencodedValue.substring(0, firstColonIndex));
    return bencodedValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length);
}
function decodeList(bencodedValue) {
    var result = [];
    var currentIdx = 1;
    while (bencodedValue[currentIdx] !== endSuffix) {
        var _a = decodeValue(bencodedValue, currentIdx), value = _a[0], nextIdx = _a[1];
        result.push(value);
        currentIdx = nextIdx;
    }
    return result;
}
function decodeDictionary(bencodedValue) {
    var result = {};
    var currentIdx = 1;
    while (bencodedValue[currentIdx] !== endSuffix) {
        var _a = decodeValue(bencodedValue, currentIdx), key = _a[0], keyNextIdx = _a[1];
        var _b = decodeValue(bencodedValue, keyNextIdx), value = _b[0], valueNextIdx = _b[1];
        if (typeof key !== 'string') {
            throw new Error("Dictionary keys must be strings");
        }
        result[key] = value;
        currentIdx = valueNextIdx;
    }
    return result;
}
function decodeValue(bencodedValue, currentIdx) {
    var remainingValue = bencodedValue.substring(currentIdx);
    if (remainingValue[0] === integerPrefix) {
        var endIdx = remainingValue.indexOf(endSuffix);
        if (endIdx === -1) {
            throw new Error("Invalid integer encoding");
        }
        var value = parseInt(remainingValue.substring(1, endIdx));
        return [value, currentIdx + endIdx + 1];
    }
    else if (!isNaN(parseInt(remainingValue[0]))) {
        var firstColonIndex = remainingValue.indexOf(stringDelimiter);
        var length_1 = parseInt(remainingValue.substring(0, firstColonIndex));
        var value = remainingValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length_1);
        return [value, currentIdx + firstColonIndex + 1 + length_1];
    }
    else if (remainingValue[0] === listPrefix) {
        var list = [];
        var idx = currentIdx + 1;
        while (bencodedValue[idx] !== endSuffix) {
            var _a = decodeValue(bencodedValue, idx), decodedValue = _a[0], nextIdx = _a[1];
            list.push(decodedValue);
            idx = nextIdx;
        }
        return [list, idx + 1];
    }
    else if (remainingValue[0] === dictionaryPrefix) {
        var dictionary = {};
        var idx = currentIdx + 1;
        while (bencodedValue[idx] !== endSuffix) {
            var _b = decodeValue(bencodedValue, idx), key = _b[0], nextIdx = _b[1];
            var _c = decodeValue(bencodedValue, nextIdx), value = _c[0], valueNextIdx = _c[1];
            if (typeof key !== 'string') {
                throw new Error("Dictionary keys must be strings");
            }
            dictionary[key] = value;
            idx = valueNextIdx;
        }
        return [dictionary, idx + 1];
    }
    throw new Error("Unsupported bencoded value");
}
