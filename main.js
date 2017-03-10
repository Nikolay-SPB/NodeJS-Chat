var Debug = true;

var Settings = {
    chatHost: 'http://localhost:8090',

    maxMessageLength: 500
};

var spamFilter = {};

var io = require('socket.io').listen(8090);

var users = {};
var date = new Date();

io.sockets.on('connection', function (socket)
{
    socket.json.send({
        status:'get_user_data'
    });

    socket.on('message', function (msg)
    {
        if (spamFilter.hasOwnProperty(socket.id) && spamFilter[socket.id].banned === true) {
            return false;
        }

        monitorSpam(socket.id, socket);

        switch (msg.action) {
            case 'new_message':
                var uid = msg.userdata.uid;
                var nick = msg.userdata.nick;
                var message = msg.message;

                // max length of message is 500 chars
                if (message.length > Settings.maxMessageLength) {
                    message = message.slice(0, Settings.maxMessageLength);
                }

                broadcastMessage(socket, uid, nick, message);
                break;

            case 'command':
                parseCommand(msg.command, msg, socket);
                break;
        }


    });

    socket.on('disconnect', function()
    {
        if (socket.hasOwnProperty('isAlternate') && socket.isAlternate === true) {
            if (users[socket.nick].alternateSockets.hasOwnProperty(socket.id)) {
                delete users[socket.nick].alternateSockets[socket.id];
            }

            debug.log('Alternate socket disconnected: ' + socket.nick);
        } else {
            if (users.hasOwnProperty(socket.nick)) {
                delete users[socket.nick];
            }

            io.sockets.json.send({
                status: 'user_left',
                userdata: socket.userdata,
                users: user.getAllUsersPublicData()
            });
        }
    });
});

function monitorSpam(socket_id, socket)
{
    if (!spamFilter.hasOwnProperty(socket_id)) {
        spamFilter[socket_id] = {
            messagesCount: 0
        };
    }

    spamFilter[socket_id].messagesCount++;

    if (spamFilter[socket_id].messagesCount >= 10) {
        socket.json.send({
            status: 'info_message',
            message: 'spam_mute_5_min'
        });

        spamFilter[socket_id].messagesCount = 0;
        spamFilter[socket_id].banned = true;

        spamFilter[socket_id].removeBanTimerId = setTimeout(function(socketId)
        {
            spamFilter[socketId].messagesCount = 0;
            spamFilter[socketId].banned = false;

            debug.log('Removed chat ban for socket: ' + socketId);
        }.bind(this, socket_id), 300000);
    } else {
        clearTimeout(spamFilter[socket_id].timerId);

        spamFilter[socket_id].timerId = setTimeout(function(socketId)
        {
            spamFilter[socketId].messagesCount = 0;
        }.bind(this, socket_id), 2000);
    }
}

function broadcastMessage(socket, uid, nick, message)
{
    debug.log('User '+uid+' ('+nick+') send message: '+message);

    socket.broadcast.json.send({
        status: 'message',
        nick: nick,
        message: message
    });

    socket.json.send({
        status: 'message',
        nick: nick,
        message: message
    });
}

function parseCommand(command, msg, socket)
{
    switch (command.name){
        case 'change_nick':
            user.changeUserNick(msg.userdata.uid, command.value, socket);
            break;

        case 'start_user_data':
            user.processNewUser(msg, socket);

            break;
    }
}

var user = {
    processNewUser: function(msg, socket)
    {
        var userdata;

        if (!msg.userdata || !msg.userdata.nick) {
            //TODO: when there is no nick
        } else {
            userdata = msg.command.value;

            // check for duplicate users
            if (users.hasOwnProperty(userdata.nick)) {
                debug.log('Duplicated user connected ' + userdata.nick);

                socket.isAlternate = true;
                socket.nick = userdata.nick;

                if (!users[userdata.nick].hasOwnProperty('alternateSockets')) {
                    users[userdata.nick].alternateSockets = {};
                }
                users[userdata.nick].alternateSockets[socket.id] = socket;

                socket.json.send({
                    status: 'connected',
                    userdata: userdata,
                    users: user.getAllUsersPublicData()
                });

                return false;
            }

            users[userdata.nick] = {};
            socket.nick = userdata.nick;
        }


        socket.broadcast.json.send({
            status: 'new_user',
            userdata: userdata,
            users: user.getAllUsersPublicData()
        });

        debug.log('New user joined: ' + JSON.stringify(userdata));

        socket.json.send({
            status:'connected',
            userdata: userdata,
            users: user.getAllUsersPublicData()
        });
    },

    changeUserNick: function(user_id, new_nick, socket)
    {
        for (var i in users) {
            var curuser = users[i];

            if (curuser.uid == user_id) {
                var oldnick = curuser.nick;
                users[i].nick = new_nick;

                socket.json.send({
                    status: 'nick_change',
                    oldnick: oldnick,
                    newnick: new_nick,
                    users: user.getAllUsersPublicData()
                });

                socket.broadcast.json.send({
                    status: 'user_changed_nick',
                    oldnick: oldnick,
                    newnick: new_nick,
                    users: user.getAllUsersPublicData()
                });

                debug.log('User ' + user_id + ' changed nick from ' + oldnick + ' to ' + new_nick);

                break;
            }
        }
    },

    getAllUsersPublicData: function()
    {
        var endusers = [];

        for (var i in users) {
            endusers.push({
                nick: i
            });
        }

        return endusers;
    }
};

var debug = {
    log: function(msg)
    {
        if (Debug === true) {
            console.log(msg);
        }
    }
};

debug.log('Server started ' + date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear() +
    ' ' + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds());