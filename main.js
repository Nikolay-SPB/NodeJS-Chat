var Debug = true;

var Settings = {
    chatHost: 'http://localhost:8090',

    maxMessageLength: 500
};

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
        switch (msg.action) {
            case 'new_message':
                var uid = msg.userdata.uid;
                var nick = msg.userdata.nick;
                var message = msg.message;

                
                if (checkForBan(socket) === true) {
                    return false;
                }

                monitorSpam(socket.id, socket);

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
        try {
            delete users[socket.nick].sockets[socket.id];

            io.sockets.json.send({
                status: 'user_left',
                userdata: socket.userdata,
                users: user.getAllUsersPublicData()
            });
        } catch ($e) {
            debug.log('[CRITICAL] ' + $e);
        }
    });
});

function monitorSpam(socket_id, socket)
{
    var nick = socket.nick;
    var user = users[nick];

    if (!user.hasOwnProperty('spamMessagesCount')) {
        user.spamMessagesCount = 0;
    }

    user.spamMessagesCount++;

    if (user.spamMessagesCount >= 10) {
        sendInfoMessage('spam_mute_5_min', nick);

        user.spamMessagesCount = 0;
        user.spamBanned = true;

        user.removeBanTimerId = setTimeout(function(user)
        {
            user.spamMessagesCount = 0;
            user.spamBanned = false;

            debug.log('Removed chat ban for socket: ' + nick);
        }.bind(this, user), 300000);
    } else {
        clearTimeout(user.timerId);

        user.timerId = setTimeout(function(user)
        {
            user.spamMessagesCount = 0;
        }.bind(this, user), 2000);
    }
}

function sendInfoMessage(message, nick)
{
    var i;
    var sMessage = {
        status: 'info_message',
        message: message
    };

    var sockets = users[nick].sockets;

    for (i in sockets) {
        sockets[i].json.send(sMessage);
    }
}

/**
 * Check for ban
 * @param socket
 * @returns {boolean} True if ban is actual
 */
function checkForBan(socket)
{
    try {
        var user = users[socket.nick];

        if (user.hasOwnProperty('spamBanned') && user.spamBanned === true) {
            return true;
        }

        return false;
    } catch ($e) {
        debug.log('[CRITICAL] ' + $e);
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

            socket.nick = userdata.nick;

            // check for duplicate users
            if (users.hasOwnProperty(userdata.nick)) {
                debug.log('Duplicated user connected ' + userdata.nick);

                users[userdata.nick].sockets[socket.id] = socket;
            } else {
                users[userdata.nick] = {};
                users[userdata.nick].sockets = {};
                users[userdata.nick].sockets[socket.id] = socket;

                socket.broadcast.json.send({
                    status: 'new_user',
                    userdata: userdata,
                    users: user.getAllUsersPublicData()
                });

                debug.log('New user joined: ' + JSON.stringify(userdata));
            }

            socket.json.send({
                status:'connected',
                userdata: userdata,
                users: user.getAllUsersPublicData()
            });
        }
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
            console.log(getCurrentTime() + '  ' + msg);
        }
    }
};

function getCurrentDateTime()
{
    return date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear() +
        ' ' + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}

function getCurrentTime()
{
    var h = date.getHours().length == 1 ? '0' + date.getHours() : date.getHours();
    var m = date.getMinutes().length == 1 ? '0' + date.getMinutes() : date.getMinutes();
    var s = date.getSeconds().length == 1 ? '0' + date.getSeconds() : date.getSeconds();

    return h + ":" + m + ":" + s;
}

debug.log('Server started ' + getCurrentDateTime());