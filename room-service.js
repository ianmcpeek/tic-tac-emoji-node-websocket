const randomHash = require('random-hash');
const MessageTypes = require('./message-types');

function Participant(id, socket) {
    return {
        id,
        socket,
        avatarId: -1,
        wins: 0
    };
}

class RoomObj {
    constructor(id) {
        this.id = id;
        this.participantIds = new Set();
        this.ties = 0;
        this.turnId = '';
        this.placed = 0;
        this.board = [];
        this.ended = false;
        this.readyCount = 0;
        this.winner = -1;
        this.winningTiles = [];
    }
}

function Room(id) {
    return new RoomObj(id);
}


function RoomService(messageBroker) {
    const broker = messageBroker;
    const rooms = new Map();
    // convenient way to pass socket with id lookup
    const participants = new Map();

    // generate id guarenteed not to conflict with existing rooms
    function roomId() {
        const config = {
            length: 6
        };
        let id = randomHash.generateHash(config).toUpperCase();
        while (rooms.hasOwnProperty(id)) {
            id = randomHash.generateHash(config);
        }
        return id;
    }

    return {
        // when a new client connects, a room and participant is automatically created
        createRoom: (socket) => {
            // create new participant
            const participant = Participant(randomHash.generateHash({ length: 10 }), socket);
            participants.set(participant.id, participant);
            
            // create room and add participant
            const room = Room(roomId());
            room.participantIds.add(participant.id);
            rooms.set(room.id, room);

            // create topic for room and subscribe participant
            broker.createTopic(room.id);
            broker.subscribe(room.id, participant.id, participant.socket);
            // notify new subscriber of room
            broker.postTopic(room.id, {
                type: MessageTypes.JOIN_ROOM,
                data: {
                    participantId: participant.id,
                    roomCode: room.id
                }
            });
        },
        joinRoom: (request) => {
            // should include room code and participantId
            if (rooms.has(request.code)) {
                // join room
                const room = rooms.get(request.code);
                if (!participants.has(request.participantId)) {
                    throw new Error('participant does not exist!');
                }
                const participant = participants.get(request.participantId)
                if (room.participantIds.has(participant.id)) {
                    throw new Error('participant already in room!');
                }
                room.participantIds.add(participant.id);
                broker.subscribe(room.id, participant.id, participant.socket);

                // should now be enough players to create lobby
                // post to all subscribers in room
                console.log('created lobby');
                broker.postTopic(room.id, {
                    type: MessageTypes.LOBBY_CREATED,
                    roomCode: room.id,
                    participants: Array.from(room.participantIds)
                });
            }
        },
        getRoom: (code) => {
            return rooms.has(code) ? rooms.get(code) : null;
        },
        getParticipant: (id) => {
            return participants.has(id) ? participants.get(id) : null;
        },
        startLobby: () => {

        },
        setReadyLobby: () => {

        },
        setAvatarLobby: () => {

        },
        startGame: () => {

        },
        setGameState: () => {

        },
    };
}

module.exports = {
    RoomService
};