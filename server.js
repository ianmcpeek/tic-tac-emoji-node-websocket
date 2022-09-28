const WebSocketServer = require('websocket').server;
const http = require('http');
const randomHash = require('random-hash');
const MessageTypes = require('./message-types.js');
const MessageBroker = require('./message-broker.js');
const RoomService = require('./room-service.js');

process.title = 'tic-tac-emoji';

const hostname = 'localhost';
const PORT = 3000;

const broker = MessageBroker.MessageBroker();
const roomService = RoomService.RoomService(broker);

// WebServer code

const server = http.createServer((req, res) => {});
server.listen(PORT, hostname, () => {
    console.log(`Server running at http://${hostname}:${PORT}`);
});

const socketServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: true
});

function winningTiles(board) {
    const tiles = new Set();
    // horizontal win
    if (board[0] === board[1] && board[1] === board[2] && board[0] !== -1) {
        tiles.add(0); tiles.add(1); tiles.add(2);
    }
    if (board[3] === board[4] && board[4] === board[5] && board[3] !== -1) {
        tiles.add(3); tiles.add(4); tiles.add(5);
    }
    if (board[6] === board[7] && board[7] === board[8] && board[6] !== -1) {
        tiles.add(6); tiles.add(7); tiles.add(8);
    }
    // vertical win
    if (board[0] === board[3] && board[3] === board[6] && board[0] !== -1) {
        tiles.add(0); tiles.add(3); tiles.add(6);
    }
    if (board[1] === board[4] && board[4] === board[7] && board[1] !== -1) {
        tiles.add(1); tiles.add(4); tiles.add(7);
    }
    if (board[2] === board[5] && board[5] === board[8] && board[2] !== -1) {
        tiles.add(2); tiles.add(5); tiles.add(8);
    }
    // Diagonal win
    if (board[0] === board[4] && board[4] === board[8] && board[0] !== -1) {
        tiles.add(0); tiles.add(4); tiles.add(8);
    }
    if (board[2] === board[4] && board[4] === board[6] && board[2] !== -1) {
        tiles.add(2); tiles.add(4); tiles.add(6);
    }

    return Array.from(tiles);
}

function onMessage(message) {
    // based on message type
    // pass to appropiate message type handler
    console.log('onMessage');
    console.log(message);
    if (message.type === MessageTypes.JOIN_ROOM) {
        roomService.joinRoom(message);
    } else if(message.type === MessageTypes.AVATAR_CHANGED) {
        broker.postTopic(message.code, {
            type: MessageTypes.AVATAR_CHANGED,
            participantId: message.participantId,
            avatar: message.avatar
        })
    } else if (message.type === MessageTypes.READY_CHANGED) {
        const room = roomService.getRoom(message.code);
        broker.postTopic(message.code, {
            type: MessageTypes.READY_CHANGED,
            participantId: message.participantId,
            ready: message.ready
        })

        const count = message.ready ? 1 : -1;
        room.readyCount += count;
        console.log('ready Count ' + room.readyCount);
        if (room.readyCount >= 2) {
            console.log('got here');
            // all players ready, start game
            // pick random player to go first
            const roll = Math.round(Math.random());
            console.log('roll ' + roll);
            console.log(room.participantIds);
            const participants = Array.from(room.participantIds);
            room.turnId = roll > 0 ? participants[0] : participants[1];
            console.log('turnId ' + room.turnId);
            room.board = [-1, -1, -1, -1, -1, -1, -1, -1, -1];
            console.log('but not here');
            broker.postTopic(message.code, {
                type: MessageTypes.GAME_CREATED,
                turnId: room.turnId
            });
        }
    } else if (message.type === MessageTypes.MAKE_MOVE) {
        const room = roomService.getRoom(message.code);
        if (message.participantId === room.turnId) {
            if (room.board[message.position] === -1) {
                console.log('position is available');
                room.board[message.position] = room.turnId;
                const winTiles = winningTiles(room.board);

                if (winTiles.length > 0) {
                    room.ended = true;
                    room.winner = room.turnId;
                    room.winningTiles = winTiles;
                    // const participant = roomService.getParticipant(message.participantId);
                    // participant.wins++;
                } else {
                    room.placed++;
                    // all tiles have been placed without winner
                    console.log('placed');
                    console.log(room.placed);
                    if (room.placed === 9) {
                        room.ties++;
                        room.ended = true;

                    } else {
                        console.log('went into else');
                        const participants = Array.from(room.participantIds);
                        room.turnId = room.turnId === participants[0] ? participants[1] : participants[0];
                    }
                }

                broker.postTopic(message.code, {
                    type: MessageTypes.MAKE_MOVE,
                    board: room.board,
                    turnId: room.turnId,
                    ties: room.ties,
                    ended: room.ended,
                    winner: room.winner,
                    winningTiles: room.winningTiles
                })

                // spot occupied, notify subscribers
            }
        }
        // validate move is legal
        // * correct player is submitting move
        // * position is tile not already occupied
        // * game is not ended

        // validate whether tile placed just won game
            // if one, count return all winning tiles and end game

        // validate whether game was a scratch or tie
        // rotate turn
        // send game state update
        
    } else if (message.type === MessageTypes.GAME_RESET) {
        // boot back to lobby, resetting ready, but keeping avatar and scrores
        const room = roomService.getRoom(message.code);
        const participants = Array.from(room.participantIds).map(id => roomService.getParticipant(id));
        participants[0].ready = false;
        participants[1].ready = false;
        room.readyCount = 0;
        room.ended = false;
        room.winner = -1;
        room.winningTiles = [];
        room.placed = 0;
        console.log('sending back reset');
        broker.postTopic(message.code, {
            type: MessageTypes.GAME_RESET,
        })
    }
}

socketServer.on('request', (request) => {
    console.log('Connection from origin ' + request.origin + '.');
    const connection = request.accept(null, request.origin);
    console.log('Connection accepted.');

    connection.on('message', (message) => {
        if (message.type === 'utf8') {
            console.log('recieved message');

            try {
                const json = JSON.parse(message.utf8Data);
                onMessage(json);
            } catch(error) {

            }
        }
    });

    connection.on('close', (connection) => {
        console.log((new Date()) + " Peer "
        + connection.remoteAddress + " disconnected.");

    });

    roomService.createRoom(connection);
});