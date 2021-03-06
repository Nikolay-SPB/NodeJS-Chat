//TODO: remove from here
var Debug = true;

//TODO: remove to settings
var Settings = {
    maxMessageLength: 500,

    logToFile: true,

    ban_duration: 300000
};

var io = require('socket.io').listen(8090);
var crypto = require('crypto');
var fs = require('fs');
var mysql = require('mysql');

var helpers = require('./back/helpers');

var users = {};
var bannedUsers = {};
var serverSettings = {};

readServerSettings();

io.sockets.on('connection', function (socket)
{
    socket.json.send({
        status:'get_user_data'
    });

    socket.on('message', function (msg)
    {
        try {
            switch (msg.action) {
                case 'new_message':
                    var uid = msg.userdata.uid;
                    var nick = msg.userdata.nick;
                    var nickKey = msg.userdata.nick.toLowerCase();
                    var message = msg.message;
                    var sign = msg.sign;


                    if (checkForBan(socket) === true) {
                        return false;
                    }

                    monitorSpam(socket.id, socket);

                    // max length of message is 500 chars
                    if (message.length > Settings.maxMessageLength) {
                        message = message.slice(0, Settings.maxMessageLength);
                    }

                    // security check
                    if (sign !== users[nickKey].sign) {
                        sendInfoMessage('BAD_SIGN', nick);

                        debug.log('[WARNING] User sent message with bad sign! User nick - ' + nick);
                    } else {
                        broadcastMessage(socket, uid, nick, message);
                    }

                    break;

                case 'command':
                    parseCommand(msg.command, msg, socket, msg.sign);
                    break;
            }
        } catch ($e) {
            debug.log('[CRITICAL 0x8003] ' + $e);
        }
    });

    socket.on('disconnect', function()
    {
        try {
            var i;
            var sockets_num = 0;
            var nickKey = socket.nick.toLowerCase();

            delete users[nickKey].sockets[socket.id];

            for (i in users[nickKey].sockets) {
                sockets_num++;
            }

            if (sockets_num < 1) {
                delete users[nickKey];

                io.sockets.json.send({
                    status: 'user_left',
                    nick: socket.nick,
                    users: user.getAllUsersPublicData()
                });

                debug.log('Disconnected user '+nickKey);
            }
        } catch ($e) {
            debug.log('[CRITICAL 0x8001] ' + $e);
        }
    });
});

function readServerSettings()
{
    var serverSettingsFile = './server_settings.json';

    try {
        var stat = fs.statSync(serverSettingsFile);

        var file = fs.readFileSync(serverSettingsFile);
        serverSettings = JSON.parse(file);
    } catch ($e) {
        debug.log('[CRITICAL 0x8005] ' + $e);
    }
}

function monitorSpam(socket_id, socket)
{
    var nick = socket.nick;
    var user = users[nick.toLowerCase()];
    var lnick = nick.toLowerCase();

    if (!user.hasOwnProperty('spamMessagesCount')) {
        user.spamMessagesCount = 0;
    }

    user.spamMessagesCount++;

    if (user.spamMessagesCount >= 10) {
        sendInfoMessage('spam_mute_5_min', nick);

        user.spamMessagesCount = 0;
        user.spamBanned = true;

        user.removeBanTimerId = setTimeout(function(user, nick)
        {
            var lnick = nick.toLowerCase();

            user.spamMessagesCount = 0;
            user.spamBanned = false;

            delete bannedUsers[lnick];

            sendInfoMessage('spam_unmute', nick);

            debug.log('Removed chat ban for socket: ' + nick);
        }.bind(this, user, nick), Settings.ban_duration);

        helpers.createObjectProperty(bannedUsers, lnick);
        bannedUsers[lnick].isBanned = true;
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
    var nickKey = nick.toLowerCase();

    var i;
    var sMessage = {
        status: 'info_message',
        message: message
    };

    var sockets = users[nickKey].sockets;

    for (i in sockets) {
        sockets[i].json.send(sMessage);
    }
}

function sendConnectionError(error, socket)
{
    var sMessage = {
        status: 'info_message',
        message: error
    };

    socket.json.send(sMessage);
}

/**
 * Check for ban
 * @param socket
 * @returns {boolean} True if ban is actual
 */
function checkForBan(socket)
{
    try {
        var user = users[socket.nick.toLowerCase()];
        var lnick = socket.nick.toLowerCase();

        if ((user.hasOwnProperty('spamBanned') && user.spamBanned === true)
            ||
            (bannedUsers.hasOwnProperty(lnick) && bannedUsers[lnick].isBanned === true)
        ) {
            return true;
        }

        return false;
    } catch ($e) {
        debug.log('[CRITICAL 0x8002] ' + $e);
    }
}

function broadcastMessage(socket, uid, nick, message)
{
    debug.log('User ('+nick+') send message: '+message + ' ip: ' + socket.request.connection.remoteAddress + ' ip2: ' +
        socket.handshake.address);

    socket.broadcast.json.send({
        status: 'message',
        nick: nick,
        message: message
    });

    socket.json.send({
        status: 'self_message',
        nick: nick,
        message: message
    });

    var time = new Date();
    time = Math.round( time.getTime() / 1000 );

    var query = "INSERT INTO `messages` (`m_body`, `m_date`, `author`) VALUES ('"+message+"', "+time+", '"+nick+"')";
    mysqlQuery(query);
}

function parseCommand(command, msg, socket, sign)
{
    try {
        var nick = msg.userdata.nick;
        var lNick = nick.toLowerCase();

        /* Check if command is signed */
        if (command.name !== 'start_user_data') {
            if (!lNick || !sign) {
                debug.log('[CRITICAL 0x8004b] No nick or sign');

                return false;
            }

            if (sign !== users[lNick].sign) {
                debug.log('Bad command sign from user ('+nick+')');

                sendInfoMessage('BAD_COMMAND_SIGN', nick);

                return false;
            }
        }

        switch (command.name) {
            case 'change_nick':
                user.changeUserNick(command.value, socket);
                break;

            case 'start_user_data':
                user.processNewUser(msg, socket);

                break;
        }
    } catch ($e) {
        debug.log('[CRITICAL 0x8004] ' + $e);
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

            var userKey = userdata.nick.toLowerCase().trim();
            userKey = userKey.match(/[a-zA-Z0-9а-яА-ЯёЁ_\-]{3,32}/)[0];
            userdata.nick = userdata.nick.match(/[a-zA-Z0-9а-яА-ЯёЁ_\-]{3,32}/)[0];

            if (!userKey) {
                sendConnectionError('bad_nick', socket);

                return false;
            }

            var connectionSign = userdata.hasOwnProperty('sign') ? userdata.sign : false;
            var realSign = (users.hasOwnProperty(userKey) && users[userKey].hasOwnProperty('sign')) ? users[userKey].sign : false;

            if (!realSign || realSign !== connectionSign) {
                if (users.hasOwnProperty(userKey)) {
                    sendConnectionError('nick_already_exists', socket);

                    return false;
                }
            }

            socket.nick = userdata.nick;

            // check for duplicate users
            if (users.hasOwnProperty(userKey)) {
                debug.log('Duplicated user connected ' + userKey);

                users[userKey].sockets[socket.id] = socket;
            } else {
                users[userKey] = {};
                users[userKey].sockets = {};
                users[userKey].sockets[socket.id] = socket;
                users[userKey].sign = this.generateUserSecurityHash();
                users[userKey].realNick = userdata.nick;

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
                users: user.getAllUsersPublicData(),
                sign: users[userKey].sign
            });

            getLastMessages(function(results)
            {
                socket.json.send({
                    status:'last_messages',
                    messages: results
                });
            });
        }
    },

    changeUserNick: function(new_nick, socket)
    {
        var i;

        var oldNickKey = socket.nick.toLowerCase();
        var oldNick = socket.nick;
        var sign = users[oldNickKey].sign;
        var newNickKey = new_nick.toLowerCase().trim();

        if (oldNickKey == newNickKey) {
            sendInfoMessage('NICKS_ARE_SAME', oldNick);

            return;
        }

        users[newNickKey] = users[oldNickKey];
        delete users[oldNickKey];

        for (i in users[newNickKey].sockets) {
            users[newNickKey].sockets[i].nick = new_nick;
        }

        users[newNickKey].realNick = new_nick;
        users[newNickKey].sign = sign;

        for (i in users[newNickKey].sockets) {
            users[newNickKey].sockets[i].json.send({
                status: 'nick_change',
                oldnick: socket.nick,
                newnick: new_nick,
                users: user.getAllUsersPublicData()
            });
        }

        socket.broadcast.json.send({
            status: 'user_changed_nick',
            oldnick: oldNick,
            newnick: new_nick,
            users: user.getAllUsersPublicData()
        });

        debug.log('User ' + oldNick + ' changed nick to ' + new_nick);
    },

    generateUserSecurityHash: function()
    {
        var current_date = (new Date()).valueOf().toString();
        var random = Math.random().toString();

        return crypto.createHash('sha1').update(current_date + random).digest('hex');
    },

    getAllUsersPublicData: function()
    {
        var endusers = [];

        for (var i in users) {
            endusers.push({
                nick: users[i].realNick
            });
        }

        return endusers;
    }
};

var debug = {
    logStream: false,

    log: function(msg)
    {
        var self = this;

        if (Debug === true) {
            console.log(getCurrentTime() + '  ' + msg);
        }

        if (Settings.logToFile === true) {
            if (!this.logStream) {
                fs.stat('./logs', function(err, stats)
                {
                    if (err && err.code === 'ENOENT') {
                        fs.mkdir('./logs', 400, function(e)
                        {
                            self.initLogStream();
                            self.writeToLog(msg);
                        });
                    } else {
                        self.initLogStream();
                        self.writeToLog(msg);
                    }
                });
            } else {
                self.writeToLog(msg);
            }
        }

        this.initLogStream = function()
        {
            this.logStream = fs.createWriteStream('./logs/general.log', { flags: 'a' });
        };

        this.writeToLog = function(msg)
        {
            this.logStream.write(getCurrentTime() + '  ' + msg + "\n");
        };
    }
};

function getCurrentDateTime()
{
    var date = new Date();

    return date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear() +
        ' ' + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}

function getCurrentTime()
{
    var date = new Date();

    var h = date.getHours().length == 1 ? '0' + date.getHours() : date.getHours();
    var m = date.getMinutes().length == 1 ? '0' + date.getMinutes() : date.getMinutes();
    var s = date.getSeconds().length == 1 ? '0' + date.getSeconds() : date.getSeconds();

    return h + ":" + m + ":" + s;
}

function mysqlQuery(query, callback)
{
    var connection = mysql.createConnection({
        host     : serverSettings.mysql.host,
        user     : serverSettings.mysql.user,
        password : serverSettings.mysql.pass,
        database : serverSettings.mysql.db
    });

    connection.connect();

    connection.query(query, function (error, results, fields) {
        if (error) {
            debug.log('[CRITICAL 0x8006] MySQL error: ' + error);
        } else {
            if (typeof callback === 'function') {
                callback(results);
            }
        }
    });

    connection.end();
}

function getLastMessages(callback)
{
    var query = "SELECT * FROM `messages` ORDER BY m_id DESC LIMIT 0, 20";

    mysqlQuery(query, function(results)
    {
        callback(results);
    });
}

debug.log('Server started ' + getCurrentDateTime());