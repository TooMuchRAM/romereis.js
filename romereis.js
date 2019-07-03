
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(express.urlencoded()); // to support URL-encoded bodies


app.get('/', function(req, res){
  var html = "<form action=\"" + req.protocol + '://' + req.get('host') + "/postNotif" + "\" method=\"POST\">";
  html += "<input name=\"notification\" type=\"text\" placeholder=\"Notificatie-inhoud\">";
  html += "<input name=\"password\" type=\"password\" placeholder=\"Wachtwoord\">";
  html += "<input type=\"submit\" value=\"Verzend\">";
  html += "</form>";
  res.send(html);
});
app.post('/postNotif', function(req, res){
  if(req.body.password == "FFGYA123"){
    var msg = {"channel": "notifications", "message": req.body.notification};
    broadcast(wss, JSON.stringify(msg));
    res.redirect("/");
  }
  else{
    res.send("Unauthorised");
  }
})

app.listen(3000);



const server = https.createServer({
  cert: fs.readFileSync('/etc/letsencrypt/live/toomuchram.net/fullchain.pem'),
  key: fs.readFileSync('/etc/letsencrypt/live/toomuchram.net/privkey.pem')
});
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
  ws.unauthorised = true;
  console.log("Somebody connected");
  ws.on('message', function incoming(message) {
    try{
      console.log("incoming message: " + message);
      message = JSON.parse(message);

      if(message.channel === "authorisation" && message.sessionId){
        console.log("Checking sessionId")
        getUsername(message.sessionId, function(data){
          if(data === "ERR_NO_SESSIONID" || data === "ERR_NO_SUCH_SESSION" || data === "ERR_NO_SUCH_USER"){
            ws.send(JSON.stringify({"channel":"errors", "error": data}));
            ws.terminate();
            console.log("sessionId is INCORRECT");
          }
          else{
            console.log("sessionId is CORRECT");
            ws.unauthorised = false;
          }
        });
      }
      else if(message.channel === "locations" && message.lat && message.lon && message.sessionId){
        getUsername(message.sessionId, function(data){
          if(data !== "ERR_NO_SESSIONID" && data !== "ERR_NO_SUCH_SESSION" && data !== "ERR_NO_SUCH_USER"){
            ws.unauthorised = false;
            broadcast(wss, JSON.stringify({"channel": "locations", "lat": message.lat, "lon": message.lon, "user": data}));
          }
          else{
            ws.send(JSON.stringify({"channel":"errors", "error": data}));
            ws.terminate();
          }
        });
      }
    }
    catch(e){

    }
  });

});

server.listen(443);


function broadcast(wss, msg) {
  wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN && client.unauthorised == false) {
        client.send(msg);
        console.log("sent " + msg)
      }
    });
}
function getUsername(sessionId, callback){

  https.get('https://romereis.toomuchram.net/backend/getusername.php?sessionId=' + sessionId, (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      callback(data);
    });

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  });
}
