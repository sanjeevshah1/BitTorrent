"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeDictionary = encodeDictionary;
var integerPrefix = 'i';
var stringDelimiter = ':';
var listPrefix = 'l';
var dictionaryPrefix = 'd';
var endSuffix = 'e';
function encodeDictionary(dictionary) {
    var result = dictionaryPrefix;
    for (var key in dictionary) {
        if (dictionary.hasOwnProperty(key)) {
            var encodedKey = encodeString(key);
            var encodedValue = encodeValue(dictionary[key]);
            result += encodedKey + encodedValue;
        }
    }
    result += endSuffix;
    return result;
}
function encodeString(value) {
    return value.length + stringDelimiter + value;
}
function encodeValue(value) {
    if (typeof value === 'number') {
        return 'i' + value + 'e';
    }
    else if (typeof value === 'string') {
        return encodeString(value);
    }
    else if (Array.isArray(value)) {
        return encodeList(value);
    }
    else if (typeof value === 'object') {
        return encodeDictionary(value);
    }
    else {
        throw new Error("Unsupported value type");
    }
}
function encodeList(list) {
    var result = listPrefix;
    for (var i = 0; i < list.length; i++) {
        result += encodeValue(list[i]);
    }
    result += endSuffix;
    return result;
}
// export function encodeDictionary(obj: Record<string, any>): string {
//     const sortedKeys = Object.keys(obj).sort(); // Sort keys lexicographically
//     let encodedStr = 'd'; // Start encoding a dictionary
//     for (const key of sortedKeys) {
//         encodedStr += `${key.length}:${key}`; // Bencode the key
//         encodedStr += encodeValue(obj[key]);  // Encode the value
//     }
//     encodedStr += 'e'; // End the dictionary
//     return encodedStr;
// }
// // Recursive function to handle different value types in Bencode
// function encodeValue(value: any): string {
//     if (typeof value === 'number') {
//         return `i${value}e`; // Encode integers
//     } else if (typeof value === 'string') {
//         return `${value.length}:${value}`; // Encode strings
//     } else if (Array.isArray(value)) {
//         return `l${value.map(encodeValue).join('')}e`; // Encode lists
//     } else if (typeof value === 'object') {
//         return encodeDictionary(value); // Encode nested dictionaries
//     }
//     throw new Error('Unsupported type');
// }
