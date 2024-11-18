import { DecodedResponse } from "./types";
import bencodec from 'bencodec';

export function extractPieceHashes(pieces: Buffer): string[] {
    const hashes: string[] = [];
    for (let i = 0; i < pieces.length; i += 20) {
        hashes.push(pieces.subarray(i, i + 20).toString('hex'));
    }
    return hashes;
}
export const parsePeers = (peers: Buffer): string[] => {
    const peerList: string[] = [];
    
    for (let i = 0; i < peers.length; i += 6) {
        // Extracting 6-byte chunks
        const ipBytes = peers.subarray(i, i + 4); 
        const portBytes = peers.subarray(i + 4, i + 6); 

        // Converting the IP bytes into an IPv4 address
        const ip = Array.from(ipBytes).join('.'); 

        // Converting the port bytes into a port number
        const port = (portBytes[0] << 8) + portBytes[1]; 

        peerList.push(`${ip}:${port}`); // Combining IP and port to form the expected format
    }

    return peerList;
};

export function urlEncodeHash(value: Buffer): string {
    let result = "";
    for (let index = 0; index < value.length; index++) {
      result += `%${value.subarray(index, index + 1).toString("hex")}`;
    }
    return result;
}

export const fetchTracker = async (URL: string) : Promise<string[]> => {
    const response = await fetch(URL);
    const responseBuffer = await response.arrayBuffer();
    const decodedResponse: DecodedResponse = bencodec.decode(Buffer.from(responseBuffer));
    const decodedPeers = decodedResponse.peers;
    const parsedPeers = parsePeers(decodedPeers);
    return parsedPeers;

};
