function Subscriber(id, socket) {
 return {
    id,
    socket
 };
}

function MessageBroker() {
    const topics = new Map();
    const notifySubscribers = (topic, fnMessage) => {
        if (!topics.has(topic)) {
            throw new Error('topic does not exist. ' + topic);
        }
        const subscribers = topics.get(topic).subscribers;
        for(const subscriber of subscribers.values()) {
            fnMessage(subscriber);
        }
    };

    return {
        createTopic: (id) => {
            if (topics.has(id)) {
                throw new Error('topic already created. ' + id);
            }

            topics.set(id, {
                subscribers: new Map()
            });
        },
        subscribe: (topic, id, socket) => {
            if (!topics.has(topic)) {
                throw new Error('topic does not exist. ' + topic);
            }

            const subscribers = topics.get(topic).subscribers;

            if (subscribers.has(id)) {
                throw new Error(id + ' is already subcribed to ' + topic);
            }
            subscribers.set(id, Subscriber(id, socket));
        },
        unsubscribe: (topic, id) => {
            if (!topics.has(topic)) {
                throw new Error('topic does not exist. ' + topic);
            }
        
            const subscribers = topics.get(topic).subscribers;

            if (!subscribers.has(id)) {
                throw new Error(id + ' is not subscribed to ' + topic);
            }
            subscribers.delete(id);
        },
        postTopic: (topic, json) => {
            notifySubscribers(topic, (subscriber) => {
                subscriber.socket.emit('message', json);
            });
        }
    }
}

module.exports = {
    MessageBroker
}