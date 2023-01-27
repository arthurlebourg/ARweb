import './style.css'
import { activateAR } from './client_ar';
import { place_object } from './client_ar';

import { createApp } from 'vue';
import AROverlay from './AR_overlay.vue';

var localStream: any;
var remoteVideo: any;
var peerConnection: any;
export var uuid: string;
export var serverConnection: any;
//var localVideo: any;
export var dataChannel: any;

var can_do_ar = false;

var correspondant_uuid: string;

var peerConnectionConfig = {
  'iceServers': [
    { 'urls': 'stun:stun.stunprotocol.org:3478' },
    { 'urls': 'stun:stun.l.google.com:19302' },
  ]
};


function setup_front_cam()
{
  let constraints = {
    video: true,//{ width: 1280, height: 720 }, { frameRate: { ideal: 10, max: 15 } }, { facingMode: (front? "user" : "environment") } 
    audio: false,
  };

  let button = document.createElement("input");
  button.type = "button";
  button.value = "Create call with front camera Video";
  button.className = "start_button"
  button.onclick = async function () {
    remoteVideo = document.createElement("video");
    remoteVideo.id = "remoteVideo";
    remoteVideo.autoplay = true;
    remoteVideo.style.maxWidth = "15vw";
    remoteVideo.className = "clickable";

    //document.body.appendChild(localVideo);
    document.body.appendChild(remoteVideo);

    remoteVideo.onclick = function clickEvent(e: any) {
      // e = Mouse click event.
      var rect = e.target.getBoundingClientRect();
      console.log(e.clientX + " ; " + e.clientY)
      var x = e.clientX - rect.left; //x position within the element.
      var y = e.clientY - rect.top;  //y position within the element.
      // normalize x and y to 0-1 origin is top left corner
      x = (x / rect.width) * 2 - 1;
      y = (y / rect.height) * 2 - 1;
      console.log("x? : " + x + " ; y? : " + y + ".");

      dataChannel.send(JSON.stringify({ click: { x: x, y: y } }))
    }

    let stream = await navigator.mediaDevices.getUserMedia(constraints);
    getUserMediaSuccess(stream)

    start(true, false);
  };
  document.getElementById('setup_call_container')!.insertBefore(button, document.getElementById('calls_list')!);
}

function setup_ar()
{
    can_do_ar = true
    document.getElementById('main_text')!.innerHTML = "Amazing! Your browser supports AR, you thus can start a call using AR camera."

    let button_AR = document.createElement("input");
    button_AR.type = "button";
    button_AR.className = "start_button"
    button_AR.value = "Create call with in AR";
    button_AR.onclick = async () => {
      var ardiv = document.createElement("div")
      ardiv.id = "ar_overlay"
      document.body.appendChild(ardiv)

      createApp(AROverlay).mount('#ar_overlay')!
      remoteVideo = document.getElementById('remoteVideo');
      //console.log(remoteVideo)
      
      let stream = await activateAR()
      getUserMediaSuccess(stream);


      start(true, true);
    };

    document.getElementById('setup_call_container')!.insertBefore(button_AR, document.getElementById('calls_list')!);

}

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
}

function start(isCaller: boolean, is_ar: boolean) {
  peerConnection = new RTCPeerConnection(peerConnectionConfig);
  //peerConnection.onicecandidate = gotIceCandidate;
  peerConnection.ontrack = gotRemoteStream;
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
  peerConnection.addStream(localStream);

  if (isCaller) {
    let desc = peerConnection.createOffer()//.then(createdDescription).catch(errorHandler);
    peerConnection.setLocalDescription(desc).then(function () {
    var msg = JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid , 'is_ar': is_ar});
    serverConnection.send(msg);
  }).catch(errorHandler);
  }
  document.getElementById('setup_call_container')!.style.display = "none";
}

function gotMessageFromServer(message: any) {
  /*if (!peerConnection) {
    console.log('Got message from server, but no peerConnection');
    start(false);
  }*/
  let signal = JSON.parse(message.data);

  // Ignore messages from ourself
  if (signal.uuid == uuid) return;

  if (signal.offer_removed) {
    var elm = document.getElementById(signal.uuid);
    if (elm) elm.remove();
    return;
  }

  if (signal.sdp) {
    if (signal.sdp.type == 'offer') {
      console.log('Got offer. Sending answer to peer.');
      let calls_list = document.getElementById('calls_list')!;
      let button = document.createElement("input");
      button.type = "button";
      button.className = "start_button"
      button.value = "Start call with " + signal.uuid + " with front camera video";
      button.id = signal.uuid;
      button.onclick = async () => {
        let constraints = {
          video: true,//{ width: 1280, height: 720 }, { frameRate: { ideal: 10, max: 15 } }, { facingMode: (front? "user" : "environment") } 
          audio: false,
        };
        remoteVideo = document.createElement("video");
        remoteVideo.id = "remoteVideo";
        remoteVideo.autoplay = true;
        remoteVideo.style.maxWidth = "15vw";
        remoteVideo.className = "clickable";

        //document.body.appendChild(localVideo);
        document.body.appendChild(remoteVideo);

        remoteVideo.onclick = function clickEvent(e: any) {
          // e = Mouse click event.
          var rect = e.target.getBoundingClientRect();
          console.log(e.clientX + " ; " + e.clientY)
          var x = e.clientX - rect.left; //x position within the element.
          var y = e.clientY - rect.top;  //y position within the element.
          // normalize x and y to 0-1 origin is top left corner
          x = (x / rect.width) * 2 - 1;
          y = (y / rect.height) * 2 - 1;
          console.log("x? : " + x + " ; y? : " + y + ".");

          dataChannel.send(JSON.stringify({ click: { x: x, y: y } }))
        }

        let stream = await navigator.mediaDevices.getUserMedia(constraints);

        getUserMediaSuccess(stream)

        start(false, false)
        correspondant_uuid = signal.uuid;
        peerConnection.onicecandidate = gotIceCandidate;
        peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
          var desc = peerConnection.createAnswer();//.then(createdDescription).catch(errorHandler);
          peerConnection.setLocalDescription(desc).then(function () {
            var msg = JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid, 'aimed_uuid': signal.uuid });
            serverConnection.send(msg);
          }).catch(errorHandler);
        }).catch(errorHandler);
      }
      
      calls_list.appendChild(button);
      if (can_do_ar && !signal.is_ar) {
        let button_ar = document.createElement("input");
        button_ar.type = "button";
        button_ar.className = "start_button"
        button_ar.value = "Start call with " + signal.uuid + " with AR camera";
        button_ar.onclick = async () => {
          var ardiv = document.createElement("div")
          ardiv.id = "ar_overlay"
          document.body.appendChild(ardiv)

          createApp(AROverlay).mount('#ar_overlay')!
          remoteVideo = document.getElementById('remoteVideo');
          //console.log(remoteVideo)

          let stream = await activateAR()
          getUserMediaSuccess(stream);

          start(false, true)
          correspondant_uuid = signal.uuid;
          peerConnection.onicecandidate = gotIceCandidate;
          peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
            var desc = peerConnection.createAnswer();//.then(createdDescription).catch(errorHandler);
            peerConnection.setLocalDescription(desc).then(function () {
              var msg = JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid, 'aimed_uuid': correspondant_uuid});
              serverConnection.send(msg);
            }).catch(errorHandler);
          }).catch(errorHandler);
        }

        calls_list.appendChild(button_ar);
      }
    }
    else {
      console.log('Got answer.');
      correspondant_uuid = signal.uuid;
      peerConnection.onicecandidate = gotIceCandidate;
      peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp)).catch(errorHandler);
    }
  }
  else if (signal.ice) {
    peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}

function gotIceCandidate(event: any) {
  if (event.candidate != null) {
    var msg = JSON.stringify({ 'ice': event.candidate, 'uuid': uuid, 'aimed_uuid' : correspondant_uuid });
    serverConnection.send(msg);
  }
}

/*function createdDescription(description: any) {
  peerConnection.setLocalDescription(description).then(function () {
    var msg = JSON.stringify({ 'sdp': peerConnection.localDescription, 'uuid': uuid });
    serverConnection.send(msg);
  }).catch(errorHandler);
}*/

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
  serverConnection = new WebSocket('wss://' + window.location.host + '/');
  serverConnection.onmessage = gotMessageFromServer;

  //localVideo = document.getElementById('localVideo');
  //remoteVideo = document.getElementById('remoteVideo');

  // check if ar is available

  if (navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')) {
    setup_ar()
  }


  if (navigator.mediaDevices) {
      setup_front_cam()
  } else {
    alert('Your browser does not support getUserMedia API nor WebXR');
  }
});