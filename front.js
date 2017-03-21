/**
 * Author: Nikolay Pilipovic
 * Email: nikola.pilipovic@gmail.com
 * Created on 23.02.2017.
 */

if (typeof io == 'undefined') {
    // alert('Невозможно установить связь с сервером');

    $(function()
    {
        $('body').css('flex-direction', 'column');
        $('body').css('margin', '2%');

        document.body.innerHTML = "<h1>Невозможно установить связь с сервером.</h1>" +
            '<p> <a onclick="document.location.reload(); return false;" class="button" href="#">Попробовать еще раз</a> </p>'
        ;
    });
}

$(function()
{
    var Settings = {
        chatHost: 'http://localhost:8090',

        maxMessageLength: 500
    };

    var connected = false;
    var userdata;
    var socket;

    var sign = $.cookie('sign');

    var msgInput = $('input[name="msg-input"]');
    var msgWindow = $('div.msg-window .container');
    var msgWindowParent = $('.msg-window');
    var conBtn = $('button[data-role="chat-connect"]');
    var nickCnt = $('input[name="nick"]');
    var nickCntMain = $('div.nick');

    var btnClearWnd = $('button.clear-window');
    var btnChangeNick = $('.js-change-nick');

    var inputChangeNick = $('input[name="iChangeNick"]');

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
        doConnect();
    });

    nickCnt.on('keypress', function(e)
    {
        if (e.charCode == 13) { //# enter pressed
            doConnect();
        }
    });

    function doConnect()
    {
        var nick = validateNick(nickCnt.val());

        if (nick !== false) {
            chatConnect(nick);
        }
    }

    btnClearWnd.click(function()
    {
        msgWindow.html('');
    });

    btnChangeNick.click(function()
    {
        if (inputChangeNick.css('display') == 'none') {
            inputChangeNick.css('display', 'inline-block');
            inputChangeNick.width(150);
            inputChangeNick.focus();
        } else {
            doChangeNick();
        }
    });

    inputChangeNick.on('keypress', function(e)
    {
        if (e.charCode == 13) { //# enter pressed
            doChangeNick();
        }
    });

    function doChangeNick()
    {
        var nick = validateNick(inputChangeNick.val());

        if (nick !== false) {
            sendCommand('change_nick', nick);

            inputChangeNick.width(0);
            inputChangeNick.val('');

            setTimeout(function() {
                inputChangeNick.css('display', 'none');
            }, 1000);
        }
    }

    function chatConnect(nick)
    {
        if (socket && socket.connected === true) {
            // socket is already connected, try to connect with new nick
            userdata = {
                nick: nickCnt.val()
            };

            $.cookie('nick', nick, {path: '/'});

            sendCommand('start_user_data', userdata);

            return;
        }

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

                        setCookie('sign', msg.sign);
                        sign = msg.sign;

                        break;

                    case 'get_user_data':
                        if ($.cookie('user_data')) {
                            userdata = JSON.parse($.cookie('user_data'));
                            userdata.sign = sign;
                        } else {
                            userdata = {
                                nick: nick,
                                sign: sign
                            };
                        }

                        sendCommand('start_user_data', userdata);

                        break;

                    case 'message':
                        insertMessage(msg.nick, msg.message);
                        break;

                    case 'self_message':
                        insertMessage(msg.nick, msg.message, 'self');
                        break;

                    case 'new_user':
                        notifyNewUser(msg.userdata);
                        refreshUsersList(msg.users);
                        break;

                    case 'user_changed_nick':
                        generalNotification('Пользователь '+ msg.oldnick + ' поменял ник на ' + msg.newnick);
                        refreshUsersList(msg.users);
                        break;

                    case 'nick_change':
                        userdata.nick = msg.newnick;
                        refreshUsersList(msg.users);
                        saveUserData(userdata);
                        generalNotification('Вы поменяли ник на ' + msg.newnick);
                        break;

                    case 'user_left':
                        generalNotification(msg.nick + ' покинул(а) чат.');
                        refreshUsersList(msg.users);
                        break;

                    case 'info_message':
                        var message;

                        switch (msg.message) {
                            case 'spam_mute_5_min':
                                message = 'Вы заблокированы на 5 минут изза спама.';
                                break;

                            case 'duplicate_nick':
                                message = 'Пользователь с таким именем уже существует в чате. Пожалуйста выберите другое имя.';
                                break;

                            case 'spam_unmute':
                                message = 'Теперь можете снова писать.';
                                break;

                            case 'nick_already_exists':
                                message = 'Такой ник уже существует. Пожалуйста выберите другой.';
                                break;

                            default:
                                message = msg.message;
                                break;
                        }

                        generalNotification(message);
                        break;
                }
            });

            registeredMessage = true;
        });

        socket.on('disconnect', function()
        {
            generalNotification('Потерянна связь с чатом');

            //socket.close();
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
            msgInput.focus();
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
            message: msg,
            sign: $.cookie('sign')
        });

        msgInput.val('');
    }

    function insertMessage(nick, message, message_type)
    {
        var p = document.createElement('p');
        p.innerText = p.textContent = message;

        p.innerHTML = applySmiles(p.innerHTML);

        var cls = message_type == 'self' ? 'self' : '';

        msgWindow.append(
            '<div class="'+cls+'">' +
                '<time>['+getTime()+']</time> <span>'+nick+':</span> ' + p.innerHTML +
            '</div>'
        );

        msgWindowScrollToBottom();
    }

    function applySmiles(msg)
    {
        msg = msg.replace(/:\)/ig,     '<span title=":)" class="smiley sm1"></span>');
        msg = msg.replace(/:d/ig,    '<span title=":D" class="smiley sm2"></span>');
        msg = msg.replace(/;\)/ig,     '<span title=";)" class="smiley sm3"></span>');
        msg = msg.replace(/:\-\)/ig,    '<span title=":-)" class="smiley sm4"></span>');
        msg = msg.replace(/:\-D/ig,    '<span title=":-D" class="smiley sm5"></span>');
        msg = msg.replace(/o_o/ig,   '<span title="O_O" class="smiley sm6"></span>');
        msg = msg.replace(/\^_\^/ig,    '<span title="^_^" class="smiley sm7"></span>');
        msg = msg.replace(/:~d/ig,   '<span title=":~D" class="smiley sm8"></span>');
        msg = msg.replace(/:-x/ig,   '<span title=":-X" class="smiley sm9"></span>');

        return msg;
    }

    function notifyNewUser(userdata)
    {
        msgWindow.append(
            '<div>' +
                '<time>['+getTime()+']</time> <i>* Пользователь ' + userdata.nick + ' присоединился к чату</i>' +
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

    function validateNick(nick)
    {
        var match = nick.match(/[a-zA-Z0-9а-яА-ЯёЁ_\-]{3,32}/u);

        if (match && match[0].length >= 3) {
            $.cookie('nick', match, {path: '/'});

            return match[0];
        } else {
            alert('Допустимая длина ника от 3 до 32 символа. Может содержать только буквы, цифры, дефис и нижнее подчеркивание.');

            return false;
        }

        return false;
    }
});