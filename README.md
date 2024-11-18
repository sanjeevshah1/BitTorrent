# Building My Own BitTorrent Using TypeScript

## Features

- **Peer-to-Peer File Sharing**: Communicates with other peers to download and share pieces of files.
- **Piece Downloading**: Downloads specific pieces of a file from peers using the BitTorrent protocol.
- **Support for `.torrent` Files**: Parses `.torrent` files to extract metadata and initiate file downloads.
- **Terminal Interface**: The current implementation runs entirely in the terminal with no user interface.
- **Simplified Assumptions**: The current version assumes that all peers have all necessary pieces.

## Technologies Used

- **TypeScript**: For building a scalable and maintainable codebase.
- **Node.js**: For handling network communication and file system operations.
- **Bencode**: For decoding and encoding `.torrent` file data.
- **Net Module**: For socket communication between peers.

## Installation

1. **Clone the repository:**
   ```bash
   git clone git@github.com:sanjeevshah1/Bittorrent.git
   cd Bittorrent


## Usage

1. **Prepare a `.torrent` file**: 
   - Place a valid `.torrent` file in the `torrents` directory. The file should contain metadata for the desired file to be downloaded.
   
2. **Edit the configuration**:
   - The current implementation requires you to manually specify:
     - The piece index you want to download.
     - The peer's IP address and port number.
   - Update these values in the code before running the application.

3. **Run the application**:
   - Use the following command:
     ```bash
     bun run start
     ```
   - The progress and logs will be displayed in the terminal.

4. **Check the output file**:
   - The downloaded piece will be saved in the specified output path once the download is complete.

## Current Limitations

- **Assumes Full Piece Availability**: The current client does not check if the requested piece exists with the peer. It assumes all peers have all pieces.
- **No Data Verification**: Hash checks are not implemented, so downloaded pieces are not verified for data integrity.
- **No Multi-Peer Support**: The client connects to only one peer at a time, limiting download speed.
- **Lacks Upload Functionality**: The client cannot upload pieces to other peers, affecting its contribution to the swarm.
- **Terminal-Only Interface**: There is no graphical user interface (GUI); the application runs entirely from the terminal.
- **Limited Error Handling**: The reconnection attempts and error handling mechanisms are basic and may not cover all edge cases.

## Future Work

- **Bitfield Support**: Implement bitfield parsing to ensure the client only requests pieces that the peer has.
- **Piece Hash Verification**: Add hash checks for each downloaded piece to guarantee data integrity and prevent corruption.
- **Multi-Peer Downloading**: Enable concurrent downloads from multiple peers to increase overall download speed.
- **Tracker Communication**: Implement interaction with trackers for better peer discovery and dynamic updates.
- **Uploading Capability**: Extend the client to upload pieces to other peers, enhancing its contribution to the BitTorrent network.
- **Graphical User Interface**: Develop a simple web-based UI for easier user interaction and monitoring of downloads.
- **Enhanced Error Handling**: Improve error handling, including better reconnection logic and edge case management.
- **Piece Prioritization**: Implement strategies to request rare or sequential pieces to optimize download efficiency.
