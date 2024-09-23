function decodeBencode(bencodedValue) {
    if (bencodedValue[0] === 'i') {
        // Handle integers
        var firstDigitIndex = 1;
        var lastDigitIndex = bencodedValue.indexOf('e');
        if (lastDigitIndex === -1) {
            throw new Error("Invalid integer encoding");
        }
        return parseInt(bencodedValue.substring(firstDigitIndex, lastDigitIndex));
    }
    else if (!isNaN(parseInt(bencodedValue[0]))) {
        // Handle strings
        var firstColonIndex = bencodedValue.indexOf(":");
        if (firstColonIndex === -1) {
            throw new Error("Invalid string encoding");
        }
        var length_1 = parseInt(bencodedValue.substring(0, firstColonIndex));
        return bencodedValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length_1);
    }
    else if (bencodedValue[0] === "l") {
        // Handle lists
        var result = [];
        var currentIdx = 1;
        while (bencodedValue[currentIdx] !== "e") {
            var _a = decodeValue(bencodedValue, currentIdx), value = _a[0], nextIdx = _a[1];
            result.push(value);
            currentIdx = nextIdx;
        }
        return result;
    }
    else if (bencodedValue[0] === 'd') {
        // Handle dictionaries
        var result = {};
        var currentIdx = 1;
        while (bencodedValue[currentIdx] !== 'e') {
            var _b = decodeValue(bencodedValue, currentIdx), key = _b[0], keyNextIdx = _b[1];
            var _c = decodeValue(bencodedValue, keyNextIdx), value = _c[0], valueNextIdx = _c[1];
            if (typeof key !== 'string') {
                throw new Error("Dictionary keys must be strings");
            }
            result[key] = value;
            currentIdx = valueNextIdx;
        }
        return result;
    }
    else {
        throw new Error("Unsupported bencoded value");
    }
}
function decodeValue(bencodedValue, currentIdx) {
    var remainingValue = bencodedValue.substring(currentIdx);
    if (remainingValue[0] === 'i') {
        // Decode integer
        var endIdx = remainingValue.indexOf('e');
        if (endIdx === -1) {
            throw new Error("Invalid integer encoding");
        }
        var value = parseInt(remainingValue.substring(1, endIdx));
        return [value, currentIdx + endIdx + 1];
    }
    else if (!isNaN(parseInt(remainingValue[0]))) {
        // Decode string
        var firstColonIndex = remainingValue.indexOf(":");
        var length_2 = parseInt(remainingValue.substring(0, firstColonIndex));
        var value = remainingValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length_2);
        return [value, currentIdx + firstColonIndex + 1 + length_2];
    }
    else if (remainingValue[0] === 'l') {
        // Decode list
        var list = [];
        var idx = currentIdx + 1;
        while (bencodedValue[idx] !== 'e') {
            var _a = decodeValue(bencodedValue, idx), decodedValue = _a[0], nextIdx = _a[1];
            list.push(decodedValue);
            idx = nextIdx;
        }
        return [list, idx + 1];
    }
    else if (remainingValue[0] === 'd') {
        // Decode dictionary
        var dictionary = {};
        var idx = currentIdx + 1;
        while (bencodedValue[idx] !== 'e') {
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
var args = process.argv;
var bencodedValue = args[3];
if (args[2] === "decode") {
    try {
        var decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    }
    catch (error) {
        if (error instanceof Error) {
            console.log(error.message);
        }
        else {
            console.log("Unknown error occured");
        }
    }
}
