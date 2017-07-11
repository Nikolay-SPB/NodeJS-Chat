/**
 * Author: Nikolay Pilipovic
 * Email: nikola.pilipovic@gmail.com
 * Created on 23.02.2017.
 */

//TODO: move to settings
var APP_LOCALE = 'ru';

/**
 * Prototype for String object
 * replace %s or %d with arguments
 * @returns {String}
 */
String.prototype.format = function() {
    var me = this;

    for (var i=0; i<arguments.length; i++) {
        me = me.replace(/(?:%s|%d)/, arguments[i]);
    }

    return me;
};

$.get('i18n.json', function(data)
{
    var i18n;

    if (typeof data !== 'object')
        data = JSON.parse(data);

    if (data.hasOwnProperty(APP_LOCALE)) {
        i18n = data[APP_LOCALE];

        initApplication(i18n);
    } else {
        alert('Cannot load localization');
    }
});

function initApplication(i18n)
{
    $(function()
    {
        if (typeof io === 'undefined') {
            // alert('Невозможно установить связь с сервером');

            $(function()
            {
                $('body').css('flex-direction', 'column');
                $('body').css('margin', '2%');

                document.body.innerHTML = i18n.cantConnect +
                    '<p> <a onclick="document.location.reload(); return false;" class="button" href="#">'+i18n.tryAgain+'</a> </p>'
                ;
            });
        }

        //TODO: move to settings
        var Settings = {
            chatHost: 'http://'+document.location.hostname+':8090',

            maxMessageLength: 500
        };

        var connected = false;
        var userdata;
        var socket;

        var sign = $.cookie('sign');

        var msgInput = $('input[name="msg-input"]');
        var msgWindow = $('.msg-window .container');
        var conBtn = $('button[data-role="chat-connect"]');
        var nickCnt = $('input[name="nick"]');
        var nickCntMain = $('div.nick');

        var btnClearWnd = $('button.clear-window');
        var btnChangeNick = $('.js-change-nick');
        var btnSubmitMessage = $('button[name="submitMessage"]');

        var bottomCnt = $('.msg-btm');
        var nickSpan = $('span.nick');

        var inputChangeNick = $('input[name="iChangeNick"]');

        var usersCnt = $('div.users .users-container');
        var rightActionsBar = $('.r-actions');

        var registeredMessage = false;

        var allowedNotifications = false;

        /* Init sequence */
        //initNotifications();
        initSmilesTipsContainer();
        initClipboardHandler();

        msgWindow.delegate('div:not(".self") > span.nick', 'click', function()
        {
            var $nick = $(this).text().replace(':', '');

            msgInput.val($nick + ', ');
            msgInput.focus();
        });

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

        btnSubmitMessage.on('click', function()
        {
            if (msgInput.val().length > 0) {
                submitMessage(msgInput.val());

                msgInput.focus();
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
            if (e.charCode === 13) { //# enter pressed
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
            if (inputChangeNick.css('display') === 'none') {
                inputChangeNick.css('display', 'inline-block');
                inputChangeNick.width(150);
                inputChangeNick.focus();
            } else {
                doChangeNick();
            }
        });

        inputChangeNick.on('keypress', function(e)
        {
            if (e.charCode === 13) { //# enter pressed
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

        function initNotifications()
        {
            Notification.requestPermission(function(permission)
            {
                if (permission === 'granted') {
                    allowedNotifications = true;
                }
            });
        }

        function initClipboardHandler()
        {
            // Disabled @ moment
            /*window.addEventListener('paste', function(e)
             {
             var items = e.clipboardData.items;

             if (items) {
             for (var i = 0; i < items.length; i++) {
             var item = items[i];

             if (item.type.indexOf("image") !== -1) {
             var blob = item.getAsFile();
             var url = window.URL;
             var src = url.createObjectURL(blob);

             $('body').css('background-image', 'url('+src+')');
             }
             }
             }
             });*/
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
                            showRightActionsBar();

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
                            generalNotification(i18n.userChangedNick.format(msg.oldnick, msg.newnick));
                            refreshUsersList(msg.users);
                            break;

                        case 'nick_change':
                            userdata.nick = msg.newnick;
                            refreshUsersList(msg.users);
                            saveUserData(userdata);
                            generalNotification(i18n.youChangedNick.format(msg.newnick));
                            break;

                        case 'user_left':
                            generalNotification(i18n.leftChat.format(msg.nick));
                            refreshUsersList(msg.users);
                            break;

                        case 'info_message':
                            var message;

                            if (i18n.hasOwnProperty(msg.message)) {
                                message = i18n[msg.message];
                            } else {
                                message = msg.message;
                            }

                            generalNotification(message);
                            break;

                        case 'last_messages':

                            for (var i=msg.messages.length-1; i >= 0; i--) {

                                insertMessage(msg.messages[i].author, msg.messages[i].m_body, '', msg.messages[i].m_date * 1000);
                            }

                            break;
                    }
                });

                registeredMessage = true;
            });

            socket.on('disconnect', function()
            {
                generalNotification(i18n.chatDisconnected);

                //socket.close();
            });
        }

        function hideNickCntDisplayInputField()
        {
            nickCntMain.animate({
                opacity: 0
            }, 500, function() {
                nickCntMain.hide();

                generalNotification(i18n.welcomeToTheChat);

                bottomCnt.css('display', 'flex');

                msgInput.focus();
            });
        }

        function showRightActionsBar()
        {
            rightActionsBar.css('opacity', 0);
            rightActionsBar.show();

            rightActionsBar.animate({

                opacity: 1

            }, 500);
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
                userdata: userdata,
                sign: sign
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

        function insertMessage(nick, message, message_type, timestamp)
        {
            var p = document.createElement('p');
            p.innerText = p.textContent = message;

            p.innerHTML = applySmiles(p.innerHTML);
            p.innerHTML = parseContent(p.innerHTML);

            var cls = message_type == 'self' ? 'self' : '';

            var cTime = timestamp ? getTime(timestamp) : getTime();

            msgWindow.append(
                '<div class="'+cls+'">' +
                    '<time>'+ cTime +'</time> <span class="nick">'+nick+'</span> ' + p.innerHTML +
                '</div>'
            );

            /* send notification */
            // if (document.visibilityState != 'visible') {
            //     var notification = new Notification('Сколько ТЫЖ программистов нужно чтобы вкрутить лампочку?',
            //         {body: 'Только ты!', dir: 'auto'}
            //     );
            // }

            msgWindowScrollToBottom();
        }

        function applySmiles(msg)
        {
            msg = msg.replace(/:\)/ig,     '<span title=":)" class="smiley sm1"></span>');
            msg = msg.replace(/:\(/ig,     '<span title=":(" class="smiley sm10"></span>');
            msg = msg.replace(/:d/ig,    '<span title=":D" class="smiley sm2"></span>');
            msg = msg.replace(/;\)/ig,     '<span title=";)" class="smiley sm3"></span>');
            msg = msg.replace(/xD/g,    '<span title="xD" class="smiley sm4"></span>');
            msg = msg.replace(/:\-D/ig,    '<span title=":-D" class="smiley sm5"></span>');
            msg = msg.replace(/o_o/ig,   '<span title="O_O" class="smiley sm6"></span>');
            msg = msg.replace(/\^_\^/ig,    '<span title="^_^" class="smiley sm7"></span>');
            msg = msg.replace(/:~d/ig,   '<span title=":~D" class="smiley sm8"></span>');
            msg = msg.replace(/:-x/ig,   '<span title=":-X" class="smiley sm9"></span>');

            return msg;
        }

        function initSmilesTipsContainer()
        {
            var stci = $('.smiles-cnt > span');

            stci.click(function()
            {
                var val = msgInput.val();
                var selStart = msgInput.prop('selectionStart');
                var start = val.substr(0, selStart);
                var end = val.substr(selStart, val.length - selStart);

                msgInput.val(start + $(this).attr('title') + end);
            });
        }

        function parseContent(msg)
        {
            // parse images
            msg = msg.replace(
                /(https|http)\:\/\/(.*)\.(jpg|jpeg|png|gif|giff|bmp|svg)/i,
                '<br><a href="$1://$2.$3" target="_blank"><img src="$1://$2.$3" alt="image" /></a>'
            );

            return msg;
        }

        function notifyNewUser(userdata)
        {
            msgWindow.append(
                '<div class="notification">' +
                    '<time>['+getTime()+']</time> <i>* '+i18n.userJoined.format(userdata.nick)+'</i>' +
                '</div>'
            );

            msgWindowScrollToBottom();
        }

        function generalNotification(msg)
        {
            msgWindow.append(
                '<div class="notification">' +
                    '<time>'+getTime()+'</time> <i>* ' + msg +'</i>' +
                '</div>'
            );

            msgWindowScrollToBottom();
        }

        function getTime(timestamp)
        {
            var dt = new Date();

            if (timestamp) {
                dt.setTime(timestamp);
            }

            return dt.getHours() + ":" + (dt.getMinutes().toString().length == 1 ? ('0' + dt.getMinutes()) : dt.getMinutes());
        }

        function msgWindowScrollToBottom()
        {
            msgWindow.scrollTop(msgWindow.prop('scrollHeight'));
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
                alert(i18n.badNickFormat);

                return false;
            }

            return false;
        }
    });
}