const integerPrefix = 'i';
const stringDelimiter = ':';
const listPrefix = 'l';
const dictionaryPrefix = 'd';
const endSuffix = 'e';
export function encodeDictionary(dictionary: Record<string, any>): string {
    let result = dictionaryPrefix;
    for (const key in dictionary) {
        if (dictionary.hasOwnProperty(key)) {
            const encodedKey = encodeString(key);
            const encodedValue = encodeValue(dictionary[key]);
            result += encodedKey + encodedValue;
        }
    }
    result += endSuffix;
    return result;
}

function encodeString(value: string): string {
    return value.length + stringDelimiter + value;
}

function encodeValue(value: any): string {
    if (typeof value === 'number') {
        return 'i' + value + 'e';
    } else if (typeof value === 'string') {
        return encodeString(value);
    } else if (Array.isArray(value)) {
        return encodeList(value);
    } else if (typeof value === 'object') {
        return encodeDictionary(value);
    } else {
        throw new Error("Unsupported value type");
    }
}
function encodeList(list: any[]): string {
    let result = listPrefix;
    for (let i = 0; i < list.length; i++) {
        result += encodeValue(list[i]);
    }
    result += endSuffix;
    return result;
}