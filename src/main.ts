import './style.css'
import { activateAR } from './client_ar';

var localStream: any;
var remoteVideo: any;
var peerConnection: any;
export var uuid: string;
export var serverConnection: any;
var localVideo : any;


var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.stunprotocol.org:3478'},
    {'urls': 'stun:stun.l.google.com:19302'},
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

function getUserMediaSuccess(stream : any) {
  localStream = stream;
  localVideo.srcObject = stream;
}

function start(isCaller : boolean) {
  console.log('isCaller : ' + isCaller)
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;
  peerConnection.addStream(localStream);

  if(isCaller) {
    peerConnection.addStream(localStream);
    peerConnection.createOffer().then(createdDescription).catch(errorHandler);
  }
}

function gotMessageFromServer(message : any) {
  if(!peerConnection) start(false);

  let signal = JSON.parse(message.data);


  // Ignore messages from ourself
  if(signal.uuid == uuid) return;

  if(signal.sdp)
  {
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
      // Only create answers in response to offers
      if (signal.sdp.type == 'offer')
      {
        peerConnection.createAnswer().then(createdDescription).catch(errorHandler);
      }
    }).catch(errorHandler);

  }
  else if (signal.ice)
  {
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}

function gotIceCandidate(event : any) {
  if(event.candidate != null) {
    var msg = JSON.stringify({'ice': event.candidate, 'uuid': uuid});
    serverConnection.send(msg);
  }
}

function createdDescription(description : any) {
  console.log('got description');

  peerConnection.setLocalDescription(description).then(function() {
    var msg = JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid});
    serverConnection.send(msg);
  }).catch(errorHandler);
}

function gotRemoteStream(event : any) {
  console.log('got remote stream');
  remoteVideo.srcObject = event.streams[0];
}

function errorHandler(error : any) {
  console.log(error);
}

document.addEventListener("DOMContentLoaded", () => {
  uuid = createUUID();
  console.log('UUID : ' + uuid);
  serverConnection = new WebSocket('ws://' + window.location.host + '/');
  serverConnection.onmessage = gotMessageFromServer;

  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');

  let constraints = {
    video: true,//{ width: 1280, height: 720 }, { frameRate: { ideal: 10, max: 15 } }, { facingMode: (front? "user" : "environment") } 
    audio: false,
  };

  if (navigator.xr)
  {
    let button_AR = document.createElement("input");
    button_AR.type = "button";
    button_AR.value = "Start AR";
    button_AR.onclick = async () => {
      let stream = await activateAR()

      getUserMediaSuccess(stream);

      start(true);
    };
    
    document.body.appendChild(button_AR);
  }
  if (navigator.mediaDevices.getUserMedia)
  {
    let button = document.createElement("input");
    button.type = "button";
    button.value = "Start front camera Video";
    button.onclick = async function () {
      let stream = await navigator.mediaDevices.getUserMedia(constraints);

      getUserMediaSuccess(stream)
      
      start(true);
    };

    document.body.appendChild(button);
  } else {
    alert('Your browser does not support getUserMedia API nor WebXR');
  }
});


  
/*  
if (navigator.xr) 
{
  document.addEventListener("DOMContentLoaded", () => {
    // get button element
    const button = document.getElementById("xr")!;
    button.addEventListener("click", activateAR);
  });
}
else {
  //get image element with id 'video'
  var video_elm = document.getElementById("video") as HTMLImageElement;
  socket.on('computer video', data => {
    console.log("recived video");
    video_elm.src = data;
    //saveFile(data.replace("image/jpeg", "image/octet-stream"), "test.jpg");
  });

  document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById("xr")!;
    button.parentNode!.removeChild(button);

    // create text element
    var text = document.createElement("p");
    text.innerHTML = "Your browser does not support WebXR";
    document.body.appendChild(text);
    
  });
  
};*/