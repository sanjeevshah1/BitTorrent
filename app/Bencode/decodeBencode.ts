const integerPrefix = 'i';
const stringDelimiter = ':';
const listPrefix = 'l';
const dictionaryPrefix = 'd';
const endSuffix = 'e';

export function decodeBencode(bencodedValue: string): string | number | any[] | Record<string, any> {
    if (bencodedValue[0] === integerPrefix) {
        return decodeInteger(bencodedValue);
    } else if (!isNaN(parseInt(bencodedValue[0]))) {
        return decodeString(bencodedValue);
    } else if (bencodedValue[0] === listPrefix) {
        return decodeList(bencodedValue);
    } else if (bencodedValue[0] === dictionaryPrefix) {
        return decodeDictionary(bencodedValue);
    } else {
        throw new Error("Unsupported bencoded value");
    }
}

function decodeInteger(bencodedValue: string): number {
    const firstDigitIndex = 1;
    const lastDigitIndex = bencodedValue.indexOf(endSuffix);
    if (lastDigitIndex === -1) {
        throw new Error("Invalid integer encoding");
    }
    return parseInt(bencodedValue.substring(firstDigitIndex, lastDigitIndex));
}

function decodeString(bencodedValue: string): string {
    const firstColonIndex = bencodedValue.indexOf(stringDelimiter);
    if (firstColonIndex === -1) {
        throw new Error("Invalid string encoding");
    }
    const length = parseInt(bencodedValue.substring(0, firstColonIndex));
    return bencodedValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length);
}

function decodeList(bencodedValue: string): any[] {
    const result: any[] = [];
    let currentIdx = 1;
    while (bencodedValue[currentIdx] !== endSuffix) {
        const [value, nextIdx] = decodeValue(bencodedValue, currentIdx);
        result.push(value);
        currentIdx = nextIdx;
    }
    return result;
}

function decodeDictionary(bencodedValue: string): Record<string, any> {
    const result: Record<string, any> = {};
    let currentIdx = 1;
    while (bencodedValue[currentIdx] !== endSuffix) {
        const [key, keyNextIdx] = decodeValue(bencodedValue, currentIdx);
        const [value, valueNextIdx] = decodeValue(bencodedValue, keyNextIdx);
        if (typeof key !== 'string') {
            throw new Error("Dictionary keys must be strings");
        }
        result[key] = value;
        currentIdx = valueNextIdx;
    }
    return result;
}

function decodeValue(bencodedValue: string, currentIdx: number): [string | number | any[] | Record<string, any>, number] {
    const remainingValue = bencodedValue.substring(currentIdx);

    if (remainingValue[0] === integerPrefix) {
        const endIdx = remainingValue.indexOf(endSuffix);
        if (endIdx === -1) {
            throw new Error("Invalid integer encoding");
        }
        const value = parseInt(remainingValue.substring(1, endIdx));
        return [value, currentIdx + endIdx + 1];
    } else if (!isNaN(parseInt(remainingValue[0]))) {
        const firstColonIndex = remainingValue.indexOf(stringDelimiter);
        const length = parseInt(remainingValue.substring(0, firstColonIndex));
        const value = remainingValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length);
        return [value, currentIdx + firstColonIndex + 1 + length];
    } else if (remainingValue[0] === listPrefix) {
        const list: any[] = [];
        let idx = currentIdx + 1;
        while (bencodedValue[idx] !== endSuffix) {
            const [decodedValue, nextIdx] = decodeValue(bencodedValue, idx);
            list.push(decodedValue);
            idx = nextIdx;
        }
        return [list, idx + 1];
    } else if (remainingValue[0] === dictionaryPrefix) {
        const dictionary: Record<string, any> = {};
        let idx = currentIdx + 1;
        while (bencodedValue[idx] !== endSuffix) {
            const [key, nextIdx] = decodeValue(bencodedValue, idx);
            const [value, valueNextIdx] = decodeValue(bencodedValue, nextIdx);
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

