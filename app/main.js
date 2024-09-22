function decodeBencode(bencodedValue) {
    if (bencodedValue[0] === 'i') {
        var firstDigitIndex = 1;
        var lastDigitIndex = bencodedValue.length - 1;
        return parseInt(bencodedValue.substring(firstDigitIndex, lastDigitIndex));
    }
    else if (!isNaN(parseInt(bencodedValue[0]))) {
        var firstColonIndex = bencodedValue.indexOf(":");
        if (firstColonIndex === -1) {
            throw new Error("Invalid encoded value");
        }
        return bencodedValue.substring(firstColonIndex + 1);
    }
    else if (bencodedValue[0] === "l") {
        var result = [];
        var currentIdx = 1;
        while (bencodedValue[currentIdx] !== "e") {
            var _a = decodeValue(bencodedValue, currentIdx), value = _a[0], nextIdx = _a[1];
            result.push(value);
            currentIdx = nextIdx;
        }
        return result;
    }
    else {
        throw new Error("Only strings are supported at the moment");
    }
}
function decodeValue(bencodedValue, currentIdx) {
    var remainingValue = bencodedValue.substring(currentIdx);
    // Check for integer, string, or list
    if (remainingValue[0] === 'i') {
        var endIdx = remainingValue.indexOf('e');
        var value = parseInt(remainingValue.substring(1, endIdx));
        return [value, currentIdx + endIdx + 1];
    }
    else if (!isNaN(parseInt(remainingValue[0]))) {
        var firstColonIndex = remainingValue.indexOf(":");
        var length_1 = parseInt(remainingValue.substring(0, firstColonIndex));
        var value = remainingValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length_1);
        return [value, currentIdx + firstColonIndex + 1 + length_1];
    }
    else if (remainingValue[0] === "l") {
        var list = [];
        var idx = currentIdx + 1;
        while (bencodedValue[idx] !== "e") {
            var _a = decodeValue(bencodedValue, idx), decodedValue = _a[0], nextIdx = _a[1];
            list.push(decodedValue);
            idx = nextIdx;
        }
        return [list, idx + 1];
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
        console.error(error.message);
    }
}
