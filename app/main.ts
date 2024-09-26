import * as fs from 'node:fs';
import { createHash } from 'crypto';
import bencodec from 'bencodec';
import { decodeBencode } from './Bencode/decodeBencode';

const args = process.argv;

if (args[2] === "decode") { 
    try {
        const bencodedValue: string = args[3];
        const decoded: {} = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}

function extractPieceHashes(pieces: Buffer): string[] {
    const hashes: string[] = [];
    for (let i = 0; i < pieces.length; i += 20) {
        hashes.push(pieces.subarray(i, i + 20).toString('hex'));
    }
    return hashes;
}
type Info = {
    name: string,
    "piece length": number,
    pieces: Buffer,
    length: number,
}

type TorrentFile = {
    announce: string,
    info: Info,
}

if (args[2] === "info") {
    try {
        const torrentFilePath: string  = args[3];
        const torrentFileData: Buffer = fs.readFileSync(torrentFilePath);
        const decodedTorrentFile: TorrentFile = bencodec.decode(torrentFileData);
        const fileInfo: Info = decodedTorrentFile.info;
        const encodedInfo: Buffer |string = bencodec.encode(fileInfo);
        const infoHash:string = createHash('sha1').update(encodedInfo).digest('hex');
        const pieceHashes: string[] = extractPieceHashes(fileInfo.pieces);

        console.log(`Tracker URl: ${decodedTorrentFile.announce}`);
        console.log(`Length:`,fileInfo.length);
        console.log(`Info Hash: ${infoHash}`);
        console.log("Piece Length:",fileInfo["piece length"]);
        console.log("Piece Hashes:");
        pieceHashes.forEach((hash, index) => {
            console.log(index + 1,":",hash);
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}
const parsePeers = (peers: Buffer): string[] => {
    const peerList: string[] = [];
    
    for (let i = 0; i < peers.length; i += 6) {
        // Extract 6-byte chunks
        const ipBytes = peers.slice(i, i + 4); // First 4 bytes for IP
        const portBytes = peers.slice(i + 4, i + 6); // Last 2 bytes for Port

        // Convert the IP bytes into an IPv4 address
        const ip = Array.from(ipBytes).join('.'); // Join byte values to form the IP address

        // Convert the port bytes into a port number
        const port = (portBytes[0] << 8) + portBytes[1]; // Convert bytes to a port number

        peerList.push(`${ip}:${port}`); // Combine IP and port in the expected format
    }

    return peerList;
};

function urlEncodeHash(value: Buffer): string {
    let result = "";
    for (let index = 0; index < value.length; index++) {
      result += `%${value.subarray(index, index + 1).toString("hex")}`;
    }
    return result;
  }

  type DecodedResponse = {
    peers: Buffer,
    interval: number,
    complete: number,
    incomplete: number,
}
if (args[2] === "peers") {
    try {
        const torrentFilePath: string  = args[3];
        const torrentFileData: Buffer = fs.readFileSync(torrentFilePath);
        const decodedTorrentFile: TorrentFile = bencodec.decode(torrentFileData);
        const fileInfo: Info = decodedTorrentFile.info;
        const encodedInfo: Buffer |string = bencodec.encode(fileInfo);
 
        const info_hash:Buffer = createHash('sha1').update(encodedInfo).digest();
        const req = {
            trackerUrl:  decodedTorrentFile.announce,
            info_hash: urlEncodeHash(info_hash),
            peer_id: "00112233445566778899",
            port: 6881,
            uploaded: 0,
            downloaded: 0,
            left: fileInfo.length,
            compact: 1,
        };
        console.log("The Info Hash is: ",info_hash);
        const fetchUrl = `${req.trackerUrl}?peer_id=${req.peer_id}&info_hash=${req.info_hash}&port=${req.port}&uploaded=${req.uploaded}&downloaded=${req.downloaded}&left=${req.left}&compact=${req.compact}`
        
        const fetchTracker = async (URL: string) => {
            const response = await fetch(URL);
            const responseBuffer = await response.arrayBuffer();
            const decodedResponse: DecodedResponse = bencodec.decode(Buffer.from(responseBuffer));
            console.log("Decoded Response:", decodedResponse);
            const decodedPeers = decodedResponse.peers;
            console.log("Peers:", decodedPeers);
            console.log("Peers Length:", decodedPeers.length);
           const parsedPeers = parsePeers(decodedPeers);
           console.log("Parsed Peers:", parsedPeers);
        };

        fetchTracker(fetchUrl);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}