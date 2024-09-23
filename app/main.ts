function decodeBencode(bencodedValue: string): string | number | any[] | Record<string, any> {
    if (bencodedValue[0] === 'i') {
        // Handle integers
        const firstDigitIndex = 1;
        const lastDigitIndex = bencodedValue.indexOf('e');
        if (lastDigitIndex === -1) {
            throw new Error("Invalid integer encoding");
        }
        return parseInt(bencodedValue.substring(firstDigitIndex, lastDigitIndex));
    } else if (!isNaN(parseInt(bencodedValue[0]))) {
        // Handle strings
        const firstColonIndex = bencodedValue.indexOf(":");
        if (firstColonIndex === -1) {
            throw new Error("Invalid string encoding");
        }
        const length = parseInt(bencodedValue.substring(0, firstColonIndex));
        return bencodedValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length);
    } else if (bencodedValue[0] === "l") {
        // Handle lists
        const result: any[] = [];
        let currentIdx = 1;
        while (bencodedValue[currentIdx] !== "e") {
            const [value, nextIdx] = decodeValue(bencodedValue, currentIdx);
            result.push(value);
            currentIdx = nextIdx;
        }
        return result;
    } else if (bencodedValue[0] === 'd') {
        // Handle dictionaries
        const result: Record<string, any> = {};
        let currentIdx = 1;
        while (bencodedValue[currentIdx] !== 'e') {
            const [key, keyNextIdx] = decodeValue(bencodedValue, currentIdx);
            const [value, valueNextIdx] = decodeValue(bencodedValue, keyNextIdx);
            if (typeof key !== 'string') {
                throw new Error("Dictionary keys must be strings");
            }
            result[key] = value;
            currentIdx = valueNextIdx;
        }
        return result;
    } else {
        throw new Error("Unsupported bencoded value");
    }
}

function decodeValue(bencodedValue: string, currentIdx: number): [string | number | any[] | Record<string, any>, number] {
    const remainingValue = bencodedValue.substring(currentIdx);

    if (remainingValue[0] === 'i') {
        // Decode integer
        const endIdx = remainingValue.indexOf('e');
        if (endIdx === -1) {
            throw new Error("Invalid integer encoding");
        }
        const value = parseInt(remainingValue.substring(1, endIdx));
        return [value, currentIdx + endIdx + 1];
    } else if (!isNaN(parseInt(remainingValue[0]))) {
        // Decode string
        const firstColonIndex = remainingValue.indexOf(":");
        const length = parseInt(remainingValue.substring(0, firstColonIndex));
        const value = remainingValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length);
        return [value, currentIdx + firstColonIndex + 1 + length];
    } else if (remainingValue[0] === 'l') {
        // Decode list
        const list: any[] = [];
        let idx = currentIdx + 1;
        while (bencodedValue[idx] !== 'e') {
            const [decodedValue, nextIdx] = decodeValue(bencodedValue, idx);
            list.push(decodedValue);
            idx = nextIdx;
        }
        return [list, idx + 1];
    } else if (remainingValue[0] === 'd') {
        // Decode dictionary
        const dictionary: Record<string, any> = {};
        let idx = currentIdx + 1;
        while (bencodedValue[idx] !== 'e') {
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

const args = process.argv;
const bencodedValue = args[3];

if (args[2] === "decode") {
    try {
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error: unknown) {
        if(error instanceof Error){
            console.log(error.message)
        }else{
            console.log("Unknown error occured");
        }
    }
}
