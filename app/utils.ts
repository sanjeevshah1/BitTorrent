import { DecodedResponse } from "./types";
import bencodec from 'bencodec';
import * as path from 'path';
import * as fs from 'node:fs';
import * as net from "node:net";
import { createHash } from 'crypto';
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

export async function handshake(hash: Buffer, peerId: string, portNumber: number) {
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

const MessageTypes = [
  "choke",
  "unchoke",
  "interested",
  "not interested",
  "have",
  "bitfield",
  "request",
  "piece",
  "cancel",
  "handshake",
] as const;


export async function downloadFile(
    hash: Buffer,
    peerId: string,
    portNumber: number,
    outputFilePath: string,
    pieceIndex: number,
    pieceLength: number,
    totalFileSize: number
) {
    console.log(`${new Date().toISOString()} - Starting download process for piece ${pieceIndex} from ${peerId}:${portNumber}...`);

    let socket: net.Socket | null = null;
    let keepAliveInterval: NodeJS.Timeout | null = null;
    const maxReconnectAttempts = 3;
    let reconnectAttempts = 0;

    try {
        await fs.promises.mkdir(path.dirname(outputFilePath), { recursive: true });
        console.log("Output directory created or confirmed");

        while (reconnectAttempts < maxReconnectAttempts) {
            try {
                socket = new net.Socket();
                socket.setTimeout(60000); // 60 seconds timeout

                await connectToPeer(socket, peerId, portNumber);
                console.log("Connected to peer");
                
                const peerIdBuffer = await sendHandshake(socket, hash);
                console.log(`Handshake successful. Peer ID: ${peerIdBuffer.toString('hex')}`);

                sendInterested(socket);
                console.log("Sent interested message");

                await waitForUnchoke(socket);
                console.log("Received unchoke message");

                // Start sending keep-alive messages
                keepAliveInterval = setInterval(() => sendKeepAlive(socket!), 15000);

                // If it's the last piece, calculate the correct size
                const remainingBytes = totalFileSize - (pieceIndex * pieceLength);
                const adjustedPieceLength = Math.min(pieceLength, remainingBytes);
                console.log(`Requesting piece ${pieceIndex} with length ${pieceLength}`);
                const pieceData = await downloadPiece(socket, pieceIndex, adjustedPieceLength);
                // if(pieceData.length === 0){
                //     throw new Error(`Peer ${peerId}:${portNumber} does not have the requested piece ${pieceIndex}`);
                // }
                console.log(`Downloaded piece ${pieceIndex}, length: ${pieceData.length}`);

                await fs.promises.writeFile(outputFilePath, pieceData);
                console.log(`Piece ${pieceIndex} saved to ${outputFilePath}`);

                return; // Success, exit the function
            } catch (error) {
                console.error(`${new Date().toISOString()} - Error in download process from ${peerId}:${portNumber}:`, error);
                reconnectAttempts++;
                if (reconnectAttempts < maxReconnectAttempts) {
                    console.log(`Attempting to reconnect (${reconnectAttempts}/${maxReconnectAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 5000 * reconnectAttempts));
                }
            } finally {
                if (keepAliveInterval !== null) {
                    clearInterval(keepAliveInterval);
                }
                if (socket) {
                    socket.destroy();
                    console.log(`Closed connection to ${peerId}:${portNumber}`);
                }
            }
        }
        throw new Error(`Failed to download piece ${pieceIndex} after ${maxReconnectAttempts} reconnection attempts`);
    } catch (error) {
        console.error(`${new Date().toISOString()} - Fatal error in download process:`, error);
        throw error;
    }
}

export function sendKeepAlive(socket: net.Socket) {
    const keepAlive = Buffer.alloc(4);
    socket.write(keepAlive);
    console.log("Sent keep-alive message");

/**
 * Establishes a connection to a peer using the given socket.
 * @param {net.Socket} socket The socket to use for the connection.
 * @param {string} peerId The peer ID to use for the connection.
 * @param {number} portNumber The port number to use for the connection.
 * @returns {Promise<void>} A promise that resolves when the connection is established.
 */
function connectToPeer(
    socket: net.Socket,
    peerId: string,
    portNumber: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        socket.connect(portNumber, peerId, () => {
            console.log(`Connected to peer ${peerId}:${portNumber}`);
            resolve();
        });
        socket.on('error', reject);
    });
}


/**
 * Sends a BitTorrent handshake message to a peer via a socket connection.
 * This message initiates the communication and provides the info hash of the
 * torrent we are interested in.
 * @param socket - The socket connection to the peer.
 * @param hash - The info hash of the torrent we are interested in.
 * @returns A promise that resolves when a handshake message is received from
 * the peer, which should contain the info hash that we are interested in.
 */

export function sendHandshake(socket: net.Socket, hash: Buffer): Promise<Buffer> {
    const handshake = Buffer.concat([
        Buffer.from([19]),
        Buffer.from("BitTorrent protocol"),
        Buffer.alloc(8),
        hash,
        Buffer.from("00112233445566778899"),
    ]);
    socket.write(handshake);
    return waitForMessage(socket, "handshake");
}


/**
 * Sends an "interested" message to a peer via a socket connection.
 * This informs the peer that we are interested in downloading from them.
 * @param socket - The socket connection to the peer.
 */

export function sendInterested(socket: net.Socket): void {
    socket.write(Buffer.from([0, 0, 0, 1, 2]));
}


/**
 * Waits for an "unchoke" message from a peer via a socket connection.
 * @param socket - The socket connection to the peer.
 * @returns A promise that resolves when an "unchoke" message is received, allowing further communication.
 */

export function waitForUnchoke(socket: net.Socket): Promise<void> {
    return new Promise<void>(async (resolve) => {
        const message = await waitForMessage(socket, "unchoke");
        console.log("Received unchoke message", message);
        resolve();
    });
}

/**
 * Downloads a piece from a peer.
 * 
 * @param socket The connected socket to the peer.
 * @param pieceIndex The index of the piece to download.
 * @param pieceLength The length of the piece to download.
 * @returns A promise that resolves with the downloaded piece as a Buffer.
 */

export async function downloadPiece(
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
            console.log(`Downloaded chunk: offset ${offset}, length ${content.length}`);
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
    if(completePiece.length === 0){
        throw new Error(`This Peer does not have the requested piece ${pieceIndex}`);
    }
    console.log(`Complete piece downloaded: index ${pieceIndex}, length ${completePiece.length}`);
    return completePiece;
}


/**
 * Requests a piece from a peer.
 * @param socket The connected socket to the peer.
 * @param index The index of the piece to request.
 * @param begin The starting offset of the piece to request.
 * @param length The length of the piece to request.
 * @returns A promise that resolves with the requested piece or rejects with an error.
 */

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

/**
 * Waits for a message of a given type from a socket.
 * @param socket the socket to listen to
 * @param expectedType the type of message to wait for, must be one of:
 *   "handshake", "choke", "unchoke", "interested", "not interested", "have", "bitfield",
 *   "request", "piece", "cancel"
 * @returns a promise that resolves with the received message, or rejects with an error
 */

function waitForMessage(socket: net.Socket, expectedType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);

        function handleData(data: Buffer) {
            buffer = Buffer.concat([buffer, data]);
            
            while (buffer.length > 0) {
                if (expectedType === "handshake") {
                    if (buffer.length < 68) return;
                    resolve(buffer.subarray(0, 68));
                    buffer = buffer.subarray(68);
                    return;
                }

                if (buffer.length < 4) return;
                const messageLength = buffer.readUInt32BE(0);
                if (buffer.length < messageLength + 4) return;

                const messageId = buffer[4];
                const message = buffer.subarray(0, messageLength + 4);
                buffer = buffer.subarray(messageLength + 4);

                if (MessageTypes[messageId] === expectedType) {
                    resolve(message);
                    return;
                }
            }
        }

        socket.on("data", handleData);
        socket.once("error", reject);
        socket.once("close", () => reject(new Error("Connection closed")));
    });
}


/**
 * Converts an unsigned 32-bit integer to a 4-byte Buffer.
 * The buffer is in big-endian byte order (most significant byte first).
 * @param num The number to convert.
 * @returns A Buffer containing the 4 bytes of the integer.
 */

function uint32ToBuffer(num: number): Buffer {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(num);
    return buf;
}
const args = process.argv;

/**
 * Handles the download of a specific piece from available peers.
 * 
 * It first checks the existence of the torrent file, reads the torrent file data, decodes it, and calculates the info hash.
 * Then, it forms a request object with the necessary information for fetching peers from the tracker.
 * For each peer, it attempts to download the specified piece, handling errors and retrying connections if needed.
 * 
 * @returns {Promise<void>} A promise that resolves once the download process is completed successfully.
 */

export async function handleDownloadPieceCommand() {
    const torrentFilePath = args[5];
    const outputFilePath = args[4];
    const pieceIndex = parseInt(args[6], 10);
    if (!fs.existsSync(torrentFilePath)) {
        throw new Error(`Torrent file not found: ${torrentFilePath}`);
    }
    const torrentFileData = await fs.promises.readFile(torrentFilePath);
    const decodedTorrentFile = bencodec.decode(torrentFileData) as { info: any, announce: string };
    const fileInfo = decodedTorrentFile.info;
    const encodedInfo = bencodec.encode(fileInfo);

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
    console.log(`Fetching peers from tracker: ${fetchUrl}`);
    const peers = await fetchTracker(fetchUrl);
    console.log(`Received ${peers.length} peers from tracker`);

    for (let i = 0; i < peers.length; i++) {
        const [peerId, port] = peers[i].split(":");
        const portNumber = parseInt(port, 10);
        console.log(`Attempting to download piece ${pieceIndex} from peer ${peerId}:${portNumber} (attempt number ${i + 1}/${peers.length})`);
        try {
            console.log(`Calling downloadFile function for peer ${peerId}:${portNumber}`);
            await downloadFile(info_hash, peerId, portNumber, outputFilePath, pieceIndex, fileInfo['piece length'], fileInfo.length);
            console.log("Download process completed successfully");
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