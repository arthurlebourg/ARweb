import './style.css'
import { activateAR } from './client_ar';
import { place_object } from './client_ar';

var localStream: any;
var remoteVideo: any;
var peerConnection: any;
export var uuid: string;
export var serverConnection: any;
var localVideo: any;
export var dataChannel: any;

var peerConnectionConfig = {
  'iceServers': [
    { 'urls': 'stun:stun.stunprotocol.org:3478' },
    { 'urls': 'stun:stun.l.google.com:19302' },
  ]
};

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function getUserMediaSuccess(stream: any) {
  localStream = stream;
  localVideo.srcObject = stream;
}

function start(isCaller: boolean) {
  console.log('isCaller : ' + isCaller)
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;
  peerConnection.addStream(localStream);
  dataChannel = peerConnection.createDataChannel("chat", { negotiated: true, id: 0 });
  dataChannel.onopen = (event : any) => {
  }
  dataChannel.onmessage = (event : any) => {
    console.log('Received: ' + event.data);
    let data = JSON.parse(event.data)
    if (data.click) {
      let x = data.click.x;
      let y = data.click.y;
      place_object(x, y)
    }
      
  }

  if (isCaller) {
    peerConnection.createOffer().then(createdDescription).catch(errorHandler);
  }
}

function gotMessageFromServer(message: any) {
  if (!peerConnection) start(false);

  let signal = JSON.parse(message.data);


  // Ignore messages from ourself
  if (signal.uuid == uuid) return;

  if (signal.sdp) {
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
      // Only create answers in response to offers
      if (signal.sdp.type == 'offer') {
        peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
      }
    }).catch(errorHandler);


  }
  else if (signal.ice) {
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}

function gotIceCandidate(event: any) {
  if (event.candidate != null) {
    var msg = JSON.stringify({ 'ice': event.candidate, 'uuid': uuid });
    serverConnection.send(msg);
  }
}

function createdDescription(description: any) {
  console.log('got description');

  peerConnection.setLocalDescription(description).then(function () {
    var msg = JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid });
    serverConnection.send(msg);
  }).catch(errorHandler);
}

function gotRemoteStream(event: any) {
  console.log('got remote stream');
  remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error: any) {
  console.log(error);
}

document.addEventListener("DOMContentLoaded", async () => {
  uuid = createUUID();
  console.log('UUID : ' + uuid);
  serverConnection = new WebSocket('ws://' + window.location.host + '/');
  serverConnection.onmessage = gotMessageFromServer;

  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');

  // check if ar is available

  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')) {
    let button_AR = document.createElement("input");
    button_AR.type = "button";
    button_AR.className = "start_button"
    button_AR.value = "Start back camera with AR";
    button_AR.onclick = async () => {
      let stream = await activateAR()
      getUserMediaSuccess(stream);

      start(true);
    };

    document.body.appendChild(button_AR);
  }
  if (navigator.mediaDevices.getUserMedia) {
    let constraints = {
      video: true,//{ width: 1280, height: 720 }, { frameRate: { ideal: 10, max: 15 } }, { facingMode: (front? "user" : "environment") } 
      audio: false,
    };

    let button = document.createElement("input");
    button.type = "button";
    button.value = "Start front camera Video";
    button.className = "start_button"
    button.onclick = async function () {
      let stream = await navigator.mediaDevices.getUserMedia(constraints);

      getUserMediaSuccess(stream)

      remoteVideo.onclick = function clickEvent(e : any) {
        // e = Mouse click event.
        var rect = e.target.getBoundingClientRect();
        console.log(e.clientX + " ; " + e.clientY)
        var x = e.clientX - rect.left; //x position within the element.
        var y = e.clientY - rect.top;  //y position within the element.
        // normalise to -1 - 1
        x = (x / rect.width) * 2 - 1;
        y = (y / rect.height) * 2 - 1;
        console.log("Left? : " + x + " ; Top? : " + y + ".");

        dataChannel.send(JSON.stringify({click: {x: x, y: y}}))
      }

      start(true);
    };
    document.body.appendChild(button);
    
  } else {
    alert('Your browser does not support getUserMedia API nor WebXR');
  }
});