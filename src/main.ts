import './style.css'
import { io } from "socket.io-client";
import { activateAR } from './ar_side';

const socket = io();

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
    
  });
  
};