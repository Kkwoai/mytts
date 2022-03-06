const express = require('express');
const {client: WebSocketClient} = require("websocket/lib/websocket");
const {randomBytes} = require("crypto");

const router = express.Router();

router.options('/',function(req, res){
    const req_header = req.headers['access-control-request-headers'];
    res.status(200).setHeader('access-control-allow-headers',req_header)
        .setHeader('Access-Control-Allow-Origin','https://speech.microsoft.com')
        // .setHeader('access-control-allow-origin','*')
        .setHeader('access-control-allow-methods','POST')
        .send('');
    res.send();
})

async function convert(ssml, format) {
    return new Promise((resolve, reject) => {
        let buffers= [];
        let ws = new WebSocketClient();
        ws.on('connect', connection => {
            console.log('ws connected');
            connection.on('close', (code, desc) => {
                if (code == 1000) {
                    // console.log('ws disconnected');
                } else {
                    console.log('ws connection was closed by', code, desc);
                    reject(`ws connection was closed by: [${code} ${desc}]`);
                }
            });

            connection.on('message', message => {
                if (message.type == 'utf8') {
                    console.log('ws received text:', JSON.stringify(message.utf8Data));
                    if (message.utf8Data.includes('Path:turn.end')) {
                        let result = Buffer.concat(buffers);
                        console.log('ws total received binary', result.length);

                        console.log('ws task complete');
                        connection.close(1000, 'CLOSE_NORMAL');

                        resolve(result);
                    }
                } else if (message.type == 'binary') {
                    // console.log('ws received binary:', message.binaryData.length);
                    let separator = 'Path:audio\r\n';
                    let contentIndex = message.binaryData.indexOf(separator) + separator.length;
                    let content = message.binaryData.slice(contentIndex, message.binaryData.length);
                    buffers.push(content);
                }
            });
            let configMessage = `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n
            {
                "context": {
                    "synthesis": {
                        "audio": {
                            "metadataoptions": {
                                "sentenceBoundaryEnabled": "false",
                                "wordBoundaryEnabled": "false"
                            },
                            "outputFormat": "${format}" 
                        }
                    }
                }
            }`

            console.log('ws send:', JSON.stringify(configMessage));
            connection.send(configMessage, () => {
                const requestId = randomBytes(16).toString("hex");
                let message = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` + ssml;
                console.log('ws send:', JSON.stringify(message));
                connection.send(message, (error) => {
                    if (error) {
                        console.log('ws send failed', error);
                        reject(`ws send failed: ${error}`);
                    }
                });
            });

        });

        ws.on('connectFailed', error => {
            console.log('ws connect failed', error);
            reject(`ws connect failed: ${error}`);
        });
        ws.on('httpResponse', (response, client) => {
            console.log('ws response status', response.statusCode, response.statusMessage);
        });

        ws.connect('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4');
    });
}

router.post('/',async function (req, res) {
    try {
        let r = req.body
        let format = r['ttsAudioFormat'].toString()
        let ssml = r['ssml'].toString()
        ssml = '<speak' + ssml.split('<speak')[1]
        if (ssml == null) {
            throw `Invalid ssml: ${ssml}`;
        }
        let result = await convert(ssml, format);
        res.sendDate = true;
        res.status(200)
            .setHeader('Content-Type', 'raw-24khz-16bit-mono-pcm').setHeader('Access-Control-Allow-Origin','https://speech.microsoft.com')
            .send(result);
    } catch (error) {
        console.error(error);
        res.status(503)
            .json(error);
    }
})
router.post('/ra',async function (req, res) {
    let token = 'kabasijiniu';
    if (token) {
        let authorization = req.headers['authorization'];
        console.log('verify token...', authorization);
        if (authorization != `Bearer ${token}`) {
            console.error('Invalid token');
            res.status(401).json('Invalid token');
            return;
        }
    }
    try {
        let r = req.body
        let format = req.headers['format'] || 'audio-16khz-32kbitrate-mono-mp3';
        let ssml = r
        // ssml = '<speak' + ssml.split('<speak')[1]
        if (ssml == null) {
            throw `Invalid ssml: ${ssml}`;
        }
        let result = await convert(ssml, format);
        res.sendDate = true;
        res.status(200)
            .setHeader('Content-Type', 'raw-24khz-16bit-mono-pcm')
            .send(result);
    } catch (error) {
        console.error(error);
        res.status(503)
            .json(error);
    }
})
module.exports = router;
