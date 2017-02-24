var Debug = true;

var Settings = {
    chatHost: 'http://localhost:8090',

    maxMessageLength: 500
};

var io = require('socket.io').listen(8090);
var http = require('http');

var users = [];
var uIDCounter = 1;

http.createServer(function(req, res)
{
    res.end('server 1');
}).listen(8080);

io.sockets.on('connection', function (socket)
{
    var userdata = {
        uid: uIDCounter++,
        nick: 'Guest' + Math.random().toString().replace('.', '').slice(7)
    };

    users.push(userdata);

    socket.json.send({
        status:'connected',
        userdata: userdata,
        users: user.getAllUsersPublicData()
    });

    socket.broadcast.json.send({
        status: 'new_user',
        userdata: userdata,
        users: user.getAllUsersPublicData()
    });

    debug.log('New user joined: ' + JSON.stringify(userdata));

    socket.on('message', function (msg)
    {
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
        for (var i in users) {
            var cuser = users[i];

            if (cuser.uid == userdata.uid) {
                users.splice(i,1);
                uIDCounter--;
                break;
            }
        }

        io.sockets.json.send({
            status: 'user_left',
            userdata: userdata,
            users: user.getAllUsersPublicData()
        });

        debug.log('User left: ' + JSON.stringify(userdata));
    });
});

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
    }
}

var user = {
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
                debug.log('Users:');
                debug.log(user.getAllUsersPublicData());

                break;
            }
        }
    },

    getAllUsersPublicData: function()
    {
        var endusers = [];

        for (var i in users) {
            endusers.push({
                uid: users[i].uid,
                nick: users[i].nick
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