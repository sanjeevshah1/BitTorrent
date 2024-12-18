import * as fs from 'node:fs';
import * as net from "node:net";
import * as path from 'path';
import bencodec from 'bencodec';
import { createHash } from 'crypto';
import { decodeBencode } from './Bencode/decodeBencode';
import { TorrentFile, Info } from './types';
import { extractPieceHashes,
    urlEncodeHash,
    fetchTracker,
    sendKeepAlive,
    connectToPeer,
    sendHandshake,
    sendInterested,
    waitForUnchoke,
    uint32ToBuffer,
    waitForMessage,
} from './utils';

const color = require('colors-cli/toxic')
const loading =  require('loading-cli');
const load = loading("").start()
load.stop();

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
        console.log(`Name: ${fileInfo.name}`);
        console.log(`Length:`,fileInfo.length);
        console.log(`Info Hash: ${infoHash}`);
        console.log("Piece Length:",fileInfo["piece length"]);
        console.log("Piece Count",pieceHashes.length);
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
        fetchTracker(fetchUrl).then((response) =>{
            console.log("Peers:", response);
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}

async function handshake(hash: Buffer, peerId: string, portNumber: number) {

    console.log("Starting handshake process...");

    try {
            const handshake = Uint8Array.from([
            19,
            ...(Array.from(Buffer.from("BitTorrent protocol"))),
            ...[0, 0, 0, 0, 0, 0, 0, 0],
            ...Array.from(hash),
            ...(Array.from(Buffer.from(peerId))),
        ]);

        console.log("Handshake payload created:", handshake);

        const socket = new net.Socket();

        socket.setTimeout(10000); // 10 seconds timeout

        socket.connect(portNumber, peerId, () => {
            console.log(`Connected to peer ${peerId}:${portNumber}`);
            socket.write(handshake);
            console.log("Handshake sent");
        });

        socket.on("data", (data) => {
            console.log("Received data from peer:", data);

            if (data.length >= 68) { // Minimum length of a handshake response
                const protocol = data.toString('utf8', 1, 20);
                const receivedInfoHash = data.subarray(28, 48).toString('hex');
                const peerId = data.subarray(48, 68).toString('hex');
                
                console.log("Received protocol:", protocol);
                console.log("Received info hash:", receivedInfoHash);
                console.log("Peer ID:", peerId);  

                if (receivedInfoHash !== hash.toString('hex')) {
                    console.error("Received info hash doesn't match our info hash");
                }else{
                    console.log("Handshake successful");
                }
            } else {
                console.error("Received data is too short for a handshake");
            } 
            socket.destroy();
        });

        socket.on("error", (error) => {
            console.error("Socket error:", error.message);
        });

        socket.on("close", () => {
            console.log("Connection closed");
        });

        socket.on("timeout", () => {
            console.error("Connection timed out");
            socket.destroy();
        });

    } catch (error) {
        console.error("Error in handshake process:", error);
    }
}

const DEFAULT_CHUNK_SIZE = 2 ** 14;



async function downloadFile(
    hash: Buffer,
    peerId: string,
    portNumber: number,
    outputFilePath: string,
    pieceLength: number,
    totalFileSize: number,
    pieceCount: number,
) {

    console.log(`\nDate & Time: ${new Date().toISOString()} - Starting download process for file from ${peerId}:${portNumber}...\n`);

    let socket: net.Socket | null = null;
    let keepAliveInterval: NodeJS.Timeout | null = null;

    const maxReconnectAttempts = 3;

    for (let i = 0; i < pieceCount; i++) {
        let reconnectAttempts = 0;

        try {
            await fs.promises.mkdir(path.dirname(outputFilePath), { recursive: true });
            // console.log("Output directory created or confirmed");

            while (reconnectAttempts < maxReconnectAttempts) {
                try {
                    socket = new net.Socket();
                    socket.setTimeout(60000); // 60 seconds timeout

                    await connectToPeer(socket, peerId, portNumber);
                    // console.log("Connected to peer");

                    const peerIdBuffer = await sendHandshake(socket, hash);
                    // console.log(`Handshake successful. Peer ID: ${peerIdBuffer.toString('hex')}`);

                    sendInterested(socket);

                    await waitForUnchoke(socket);

                    // Start sending keep-alive messages
                    keepAliveInterval = setInterval(() => sendKeepAlive(socket!), 15000);

                    // Calculate the correct size for the current piece
                    const remainingBytes = totalFileSize - (i * pieceLength);
                    const adjustedPieceLength = Math.min(pieceLength, remainingBytes);

                    if (adjustedPieceLength <= 0) {
                        console.log(`Skipping piece ${i} as it has no data`);
                        continue;
                    }

                    // Download the piece data
                    // load.text = `Downloading piece ${i}...`;

                    const load = loading(`Downloading...`).start()
                    load.text = `Downloading piece ${i}...`;
                    const pieceData = await downloadPiece(socket, i, adjustedPieceLength);

                    // Append the piece data to the output file
                    await fs.promises.appendFile(outputFilePath, pieceData);
                    
                // @ts-expect-error
                    load.succeed(`Piece ${i} saved to ${outputFilePath}`.green).stop()

                    // Reset reconnect attempts after successful download
                    reconnectAttempts = 0;
                    break;

                } catch (error: unknown) {
                    if(error instanceof Error) {
                        reconnectAttempts++;

                        console.log(`Error downloading piece ${i}: ${error.message}. Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`);
                        await new Promise(resolve => setTimeout(resolve, 5000 * reconnectAttempts));
                    }
                    else{
                        console.log("Unknown error occurred");
                    }
                  
                } finally {
                    load.stop();
                    if (keepAliveInterval !== null) {
                        clearInterval(keepAliveInterval);
                    }
                    if (socket) {
                        socket.destroy();
                        // console.log(`Closed connection to ${peerId}:${portNumber}`);
                    }
                }
            }

            if (reconnectAttempts >= maxReconnectAttempts) {
                throw new Error(`Failed to download piece ${i} after ${maxReconnectAttempts} attempts`);
            }

        } catch (error: unknown) {
            if(error instanceof Error){
                console.error(`${new Date().toISOString()} - Fatal error in download process: ${error.message}`);
                throw error;
            } else{
                console.log("Unknown error occurred");
            }
            
        }
    }
}









async function downloadPiece(
    socket: net.Socket,
    pieceIndex: number,
    pieceLength: number
): Promise<Buffer> {

    let left = pieceLength;
    let offset = 0;
    const pieceBuffer: Buffer[] = [];
    const maxRetries = 5;
    let retries = 0;

    while (left > 0 && retries < maxRetries) {

        try {
            const length = Math.min(left, DEFAULT_CHUNK_SIZE);
            const piece = await requestPiece(socket, pieceIndex, offset, length);
            const content = piece.subarray(13);
            pieceBuffer.push(content);
            left -= content.length;
            offset += content.length;
            retries = 0;
            // console.log(`Downloaded chunk: offset ${offset}, length ${content.length}`);

        } catch (error) {

            console.error(`Error downloading chunk at offset ${offset}: ${error}`);
            retries++;

            if (retries < maxRetries) {
                console.log(`Retrying download of chunk at offset ${offset} (attempt ${retries}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 2000 * retries)); // Exponential backoff
            } else {
                throw new Error(`Failed to download chunk at offset ${offset} after ${maxRetries} attempts`);
            }
        }
    }

    if (left > 0) {
        throw new Error(`Failed to download complete piece ${pieceIndex}. Missing ${left} bytes.`);
    }

    const completePiece = Buffer.concat(pieceBuffer);
    // console.log(`Complete piece downloaded: index ${pieceIndex}, length ${completePiece.length}`);
    return completePiece;
}

function requestPiece(
    socket: net.Socket,
    index: number,
    begin: number,
    length: number
): Promise<Buffer> {

    return new Promise((resolve, reject) => {
        const request = Buffer.concat([
            Buffer.from([0, 0, 0, 13, 6]),
            uint32ToBuffer(index),
            uint32ToBuffer(begin),
            uint32ToBuffer(length),
        ]);
        socket.write(request);

        const timeout = setTimeout(() => {
            reject(new Error(`Timeout waiting for piece ${index} at offset ${begin}`));
        }, 30000); // 30 seconds timeout for each chunk

        waitForMessage(socket, "piece")
            .then((message) => {
                clearTimeout(timeout);
                resolve(message);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}


async function handleDownloadPieceCommand() {

    const torrentFilePath = args[3];

    if (!fs.existsSync(torrentFilePath)) {
        throw new Error(`Torrent file not found: ${torrentFilePath}`);
    }

    const torrentFileData = await fs.promises.readFile(torrentFilePath);
    const decodedTorrentFile = bencodec.decode(torrentFileData) as { info: any, announce: string };
    const fileInfo = decodedTorrentFile.info;
    const encodedInfo = bencodec.encode(fileInfo);
    const pieceHashes: string[] = extractPieceHashes(fileInfo.pieces);
    const pieceCount = pieceHashes.length;
    const info_hash: Buffer = createHash('sha1').update(encodedInfo).digest();
    const req = {
        trackerUrl:  decodedTorrentFile.announce,
        encodedHash: urlEncodeHash(info_hash),
        peer_id: "00112233445566778899",
        port: 6881,
        uploaded: 0,
        downloaded: 0,
        left: fileInfo.length,
        compact: 1,
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const fetchUrl = `${req.trackerUrl}?peer_id=${req.peer_id}&info_hash=${req.encodedHash}&port=${req.port}&uploaded=${req.uploaded}&downloaded=${req.downloaded}&left=${req.left}&compact=${req.compact}`
    
    // console.log(`Fetching peers from tracker: ${fetchUrl}`);
    
    const peers = await fetchTracker(fetchUrl);
    // console.log(`Received ${peers.length} peers from tracker`);
    
    const outputFilePath = `./Download/${fileInfo.name}`;
    
    for (let i = 0; i < peers.length; i++) {
        const [peerId, port] = peers[i].split(":");
        const portNumber = parseInt(port, 10);
        // console.log(`Attempting to download file from peer ${peerId}:${portNumber} (attempt number ${i + 1}/${peers.length})`);
        
        try {
            // console.log(`Calling downloadFile function for peer ${peerId}:${portNumber}`);
            await downloadFile(info_hash, peerId, portNumber, outputFilePath,fileInfo['piece length'], fileInfo.length, pieceCount);
            return;
        } catch (error) {
            console.error(`Failed to download from peer ${peerId}:${portNumber}:`, error);
            
            if(i === peers.length - 1){
                console.error("Attempted all peers without success");
                throw new Error("Failed to download from all available peers");
            }

            console.log(`Waiting for 3 second before trying next peer`);
            await delay(3000);
        }
    }
}

if (args[2] === "handshake"){
    try{
        const torrentFilePath: string  = args[3];
        const peerIdAndPort: string = args[4];
        const [peerId, port] = peerIdAndPort.split(":");
        const portNumber = parseInt(port);
        const torrentFileData: Buffer = fs.readFileSync(torrentFilePath);
        const decodedTorrentFile: TorrentFile = bencodec.decode(torrentFileData);
        const fileInfo: Info = decodedTorrentFile.info;
        const encodedInfo: Buffer |string = bencodec.encode(fileInfo);
        const info_hash_not_hex:Buffer = createHash('sha1').update(encodedInfo).digest();
        handshake(info_hash_not_hex, peerId, portNumber);
    }catch (error: unknown) {
        if (error instanceof Error) {
            console.log(error.message);
        } else {
            console.log("Unknown error occurred");
        }
    }
}

if (args[2] === 'download') {
    handleDownloadPieceCommand()
        .catch(error => {
            console.error("Error during download:", error);
            process.exit(1);
        })
        .finally(() => {
            const load = loading("Downloading").start();
            console.log("\n");
            
        // @ts-expect-error
            load.succeed("Download completed successfully!!!".cyan);
            console.log("\n");
        });
}
