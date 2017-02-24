/**
 * Author: Nikolay Pilipovic
 * Email: nikola.pilipovic@gmail.com
 * Created on 23.02.2017.
 */

$(function()
{
    //var socket = io.connect('http://localhost:8090');

    var connected = false;
    var userdata;

    var msgInput = $('input[name="msg-input"]');
    var msgWindow = $('div.msg-window .container');
    var conBtn = $('button[data-role="chat-connect"]');
    var nickCnt = $('input[name="nick"]');

    var registeredMessage = false;

    // socket.on('connect', function()
    // {
    //     if (registeredMessage) {
    //         return;
    //     }
    //
    //     socket.on('message', function (msg)
    //     {
    //         switch (msg.status) {
    //             case 'connected':
    //                 connected = true;
    //                 userdata = msg.userdata;
    //
    //                 break;
    //
    //             case 'message':
    //                 insertMessage(msg.nick, msg.message);
    //                 break;
    //
    //             case 'new_user':
    //                 notifyNewUser(msg.userdata);
    //                 break;
    //         }
    //     });
    //
    //     registeredMessage = true;
    // });

    msgInput.on('keyup', function(e)
    {
        if (e.key == "Enter") {
            submitMessage($(this).val());
        }
    });

    conBtn.on('click', function()
    {
        var nick = nickCnt.val().match(/[a-zA-Z0-9а-яА-ЯёЁ_\-]{3,32}/);

        if (nick && nick.length >= 3) {

        } else {
            alert('Допустимая длина ника от 3 до 32 символа. Может содержать только буквы, цифры, дефис и нижнее подчеркивание.')
        }
    });

    function submitMessage(msg)
    {
        socket.send({
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

    function getTime()
    {
        var dt = new Date();

        return dt.getHours() + ":" + (dt.getMinutes().toString().length == 1 ? ('0' + dt.getMinutes()) : dt.getMinutes());
    }

    function msgWindowScrollToBottom()
    {
        msgWindow.scrollTop(msgWindow.prop('scrollHeight'));
    }
});