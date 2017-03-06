/**
 * Author: Nikolay Pilipovic
 * Email: nikola.pilipovic@gmail.com
 * Created on 23.02.2017.
 */

$(function()
{
    var Settings = {
        chatHost: 'http://localhost:8090',

        maxMessageLength: 500
    };

    var connected = false;
    var userdata;
    var socket;

    var msgInput = $('input[name="msg-input"]');
    var msgWindow = $('div.msg-window .container');
    var msgWindowParent = $('.msg-window');
    var conBtn = $('button[data-role="chat-connect"]');
    var nickCnt = $('input[name="nick"]');
    var nickCntMain = $('div.nick');
    var btnClearWnd = $('button.clear-window');
    var usersCnt = $('div.users .users-container');

    var registeredMessage = false;

    msgInput.on('keyup', function(e)
    {
        if (e.key == "Enter") {
            if (msgInput.val().length > 0) {
                submitMessage($(this).val());
            }
        } else {
            if (msgInput.val().length > Settings.maxMessageLength) {
                msgInput.val( msgInput.val().slice(0, Settings.maxMessageLength) );
            }
        }
    });

    // if nick is already set then connect
    if ($.cookie('nick') && $.cookie('nick').length > 0) {
        chatConnect($.cookie('nick'));
    }

    conBtn.on('click', function()
    {
        var nick = nickCnt.val().match(/[a-zA-Z0-9а-яА-ЯёЁ_\-]{3,32}/u);

        if (nick && nick[0].length >= 3) {
            $.cookie('nick', nick, {path: '/'});

            chatConnect(nick[0]);
        } else {
            alert('Допустимая длина ника от 3 до 32 символа. Может содержать только буквы, цифры, дефис и нижнее подчеркивание.')
        }
    });

    btnClearWnd.click(function()
    {
        msgWindow.html('');
    });

    function chatConnect(nick)
    {
        socket = io.connect(Settings.chatHost);

        socket.on('connect', function()
        {
            if (registeredMessage) {
                return;
            }

            socket.on('message', function (msg)
            {
                switch (msg.status) {
                    case 'connected':
                        connected = true;
                        userdata = msg.userdata;
                        saveUserData(userdata);

                        refreshUsersList(msg.users);

                        hideNickCntDisplayInputField();

                        setCookie('connected', 1);

                        break;

                    case 'get_user_data':
                        if ($.cookie('user_data')) {
                            userdata = JSON.parse($.cookie('user_data'));
                        } else {
                            userdata = null;
                        }

                        sendCommand('start_user_data', userdata);

                        break;

                    case 'message':
                        insertMessage(msg.nick, msg.message);
                        break;

                    case 'new_user':
                        notifyNewUser(msg.userdata);
                        refreshUsersList(msg.users);
                        break;

                    case 'user_changed_nick':
                        generalNotification('User '+ msg.oldnick + ' changed nick to ' + msg.newnick);
                        refreshUsersList(msg.users);
                        break;

                    case 'nick_change':
                        userdata.nick = msg.newnick;
                        refreshUsersList(msg.users);
                        saveUserData(userdata);
                        break;

                    case 'user_left':
                        generalNotification('User '+ msg.userdata.nick + ' left the chat');
                        refreshUsersList(msg.users);
                        break;

                    case 'info_message':
                        var message = msg.message.replace('spam_mute_5_min', 'Вы заблокированы на 5 минут изза спама.');

                        generalNotification(message);
                        break;
                }
            });

            registeredMessage = true;
        });

        socket.on('disconnect', function()
        {
            generalNotification('Потерянна связь с чатом');

            socket.close();
        });
    }

    function hideNickCntDisplayInputField()
    {
        nickCntMain.animate({
            opacity: 0
        }, 500, function() {
            nickCntMain.hide();

            generalNotification('Добро пожаловать в чат.');

            msgInput.show();
        });
    }

    function refreshUsersList(users)
    {
        usersCnt.html('');

        for (var i in users) {
            var user = users[i];

            usersCnt.append(
                '<div>' +
                    '<p class="user" data-uid="'+user.uid+'">'+user.nick+'</p>' +
                '</div>'
            );
        }
    }

    function sendCommand(cmdName, cmdValue)
    {
        socket.send({
            action: 'command',
            command: {
                name: cmdName,
                value: cmdValue
            },
            userdata: userdata
        });
    }

    function submitMessage(msg)
    {
        socket.send({
            action: 'new_message',
            userdata: userdata,
            message: msg
        });

        msgInput.val('');
    }

    function insertMessage(nick, message)
    {
        var p = document.createElement('p');
        p.innerText = p.textContent = message;

        msgWindow.append(
            '<div>' +
            '<time>['+getTime()+']</time> <span>'+nick+':</span> ' + p.innerHTML +
            '</div>'
        );

        msgWindowScrollToBottom();
    }

    function notifyNewUser(userdata)
    {
        msgWindow.append(
            '<div>' +
            '<time>['+getTime()+']</time> <i>* User ' + userdata.nick + ' joined the chat</i>' +
            '</div>'
        );

        msgWindowScrollToBottom();
    }

    function generalNotification(msg)
    {
        msgWindow.append(
            '<div>' +
                '<time>['+getTime()+']</time> <i>* ' + msg +'</i>' +
            '</div>'
        );

        msgWindowScrollToBottom();
    }

    function getTime()
    {
        var dt = new Date();

        return dt.getHours() + ":" + (dt.getMinutes().toString().length == 1 ? ('0' + dt.getMinutes()) : dt.getMinutes());
    }

    function msgWindowScrollToBottom()
    {
        msgWindowParent.scrollTop(msgWindowParent.prop('scrollHeight'));
    }

    function setCookie(name, value)
    {
        $.cookie(name, value, {path: '/'});
    }

    function saveUserData()
    {
        setCookie('user_data', JSON.stringify(userdata));
    }
});