var Debug = true;

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

    socket.json.send({status:'connected', userdata: userdata});

    socket.broadcast.json.send({
        status: 'new_user',
        userdata: userdata
    });

    debug.log('New user joined: ' + JSON.stringify(userdata));

    socket.on('message', function (msg)
    {
        var uid = msg.userdata.uid;
        var nick = msg.userdata.nick;
        var message = msg.message;

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
    });

    socket.on('disconnect', function()
    {
        io.sockets.json.send({
            status: 'user_left',
            userdata: userdata
        });

        for (var i in users) {
            var cuser = users[i];

            if (cuser.uid == userdata.uid) {
                users.splice(i,1);
                uIDCounter--;
                break;
            }
        }

        debug.log('User left: ' + JSON.stringify(userdata));
    });
});

var debug = {
    log: function(msg)
    {
        if (Debug === true) {
            console.log(msg);
        }
    }
};