
function decodeBencode(bencodedValue: string): string | number | any[]{
   
   if(bencodedValue[0] === 'i'){
        const firstDigitIndex = 1;
        const lastDigitIndex = bencodedValue.length - 1;
        return parseInt(bencodedValue.substring(firstDigitIndex,lastDigitIndex));
    } else if (!isNaN(parseInt(bencodedValue[0]))) {
        const firstColonIndex = bencodedValue.indexOf(":");
        if (firstColonIndex === -1) {
            throw new Error("Invalid encoded value");
        }
        return bencodedValue.substring(firstColonIndex + 1);
    }else if (bencodedValue[0] === "l") {
        let result = [];
        let currentIdx = 1;
        while (bencodedValue[currentIdx] !== "e") {
            const [value, nextIdx] = decodeValue(bencodedValue, currentIdx);
            result.push(value);
            currentIdx = nextIdx;
        }
        return result;
    } 
    else {
        throw new Error("Only strings are supported at the moment");
    }
}
function decodeValue(bencodedValue: string, currentIdx: number): [string | number | any[], number] {
    const remainingValue = bencodedValue.substring(currentIdx);

    if (remainingValue[0] === 'i') {
        const endIdx = remainingValue.indexOf('e');
        const value = parseInt(remainingValue.substring(1, endIdx));
        return [value, currentIdx + endIdx + 1];
    } else if (!isNaN(parseInt(remainingValue[0]))) {
        const firstColonIndex = remainingValue.indexOf(":");
        const length = parseInt(remainingValue.substring(0, firstColonIndex));
        const value = remainingValue.substring(firstColonIndex + 1, firstColonIndex + 1 + length);
        return [value, currentIdx + firstColonIndex + 1 + length];
    } else if (remainingValue[0] === "l") {
        let list = [];
        let idx = currentIdx + 1;
        while (bencodedValue[idx] !== "e") {
            const [decodedValue, nextIdx] = decodeValue(bencodedValue, idx);
            list.push(decodedValue);
            idx = nextIdx;
        }
        return [list, idx + 1];
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
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error("An unknown error occurred.");
        }
    }
}
