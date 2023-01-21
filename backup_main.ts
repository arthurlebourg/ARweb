import { createApp } from 'vue'
import './style.css'
import App from './src/App.vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { io } from "socket.io-client";

const socket = io();

if (navigator.xr) 
{
  document.addEventListener("DOMContentLoaded", () => {
    // get button element
    const button = document.getElementById("xr")!;
    button.addEventListener("click", activateXR);
  });

  const MAX_ANCHORED_OBJECTS = 30;

  async function activateXR() {
    // Add a canvas element and initialize a WebGL context that is compatible with WebXR.
    const loader = new GLTFLoader();
    var ready = false;
    const json_loader = new THREE.ObjectLoader();
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl", { xrCompatible: true })!;

    // To be continued in upcoming steps.
    const scene = new THREE.Scene();

    let anchoredObjects: any = [];

    function AddAnchoredObject(anchor: any) {
      if (anchoredObjects.length < MAX_ANCHORED_OBJECTS) {
        var data = {
          object: 'flower',
          anchor: anchor
        }

        socket.emit("add object", data);
      }
    }

    socket.on("list object", (data: any) => {
      console.log(data);
      if (data.object == 'flower' && flower) {
        const clone = flower.clone();
        clone.position.copy(reticle.position);
        clone.quaternion.copy(reticle.quaternion);

        scene.add(clone);

        anchoredObjects.push(clone);
      }
    });

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 15, 10);
    scene.add(directionalLight);


    // Set up the WebGLRenderer, which handles rendering to the session's base layer.
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      canvas: canvas,
      context: gl
    });
    renderer.autoClear = false;

    const camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = false;
    // Initialize a WebXR session using "immersive-ar".
    const session = await navigator.xr!.requestSession("immersive-ar", { requiredFeatures: ['hit-test', 'anchors', 'camera-access'] });
    session.updateRenderState({
      baseLayer: new XRWebGLLayer(session, gl)
    });
    const glBinding = new XRWebGLBinding(session, gl);

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    const referenceSpace = await session.requestReferenceSpace('local');

    let reticle: any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
      reticle = gltf.scene;
      reticle.visible = false;
      scene.add(reticle);
    })

    let flower: any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf", function (gltf) {
      flower = gltf.scene;
    });

    session.addEventListener("select", (event: any) => {
      if (flower) {
        const hitTestResults = event.frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0 && reticle) {
          const hitPose = hitTestResults[0].getPose(referenceSpace);
          let AnchorPose = new XRRigidTransform(hitPose.transform.position, hitPose.transform.orientation);

          event.frame.createAnchor(AnchorPose, referenceSpace).then((anchor: any) => {
            AddAnchoredObject(anchor);
          }, (error: any) => {
            console.log("anchor error " + error);
          });
          
          var camBinding = glBinding.getCameraImage(event.view.camera)
        }
      }
    });

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await session.requestReferenceSpace('viewer');
    // Perform hit testing using the viewer as origin.
    const hitTestSource = await session.requestHitTestSource!({ space: viewerSpace });

    let all_previous_anchors = new Set();
    var ordinal = 0;
    // Create a render loop that allows us to draw on the AR view.
    const onXRFrame = (time: any, frame: any) => {
      // Queue up the next draw request.
      session.requestAnimationFrame(onXRFrame);

      // Update the position of all the anchored objects based on the currently reported positions of their anchors
      const tracked_anchors = frame.trackedAnchors;

      if (tracked_anchors) {
        all_previous_anchors.forEach(anchor => {
          if (!tracked_anchors.has(anchor)) {
            //scene.remove(anchor.sceneObject);
          }
        });

        tracked_anchors.forEach((anchor: any) => {
          const anchorPose = frame.getPose(anchor.anchorSpace, referenceSpace);
          if (anchorPose) {
            for (var obj of anchoredObjects) {
              if (obj.anchor == anchor) {
                //obj.transform.copy(anchorPose.transform);
                //obj.visible = true;
              }
            }
          } else {
            //anchor.context.sceneObject.visible = false;
          }
        });

        all_previous_anchors = tracked_anchors;
      } else {

        all_previous_anchors.forEach(anchor => {
          //scene.remove(anchor.sceneObject);
        });

        all_previous_anchors = new Set();
      }

      // Bind the graphics framebuffer to the baseLayer's framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer!.framebuffer)

      // Retrieve the pose of the device.
      // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
      const pose = frame.getViewerPose(referenceSpace);
      if (pose) {
        // In mobile AR, we only have one view.
        const view = pose.views[0];

        const viewport = session.renderState.baseLayer!.getViewport(view)!;
        renderer.setSize(viewport.width, viewport.height)

        // Use the view's transform matrix and projection matrix to configure the THREE.camera.
        camera.matrix.fromArray(view.transform.matrix)
        camera.projectionMatrix.fromArray(view.projectionMatrix);
        camera.updateMatrixWorld(true);

        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0 && reticle) {

          if (!ready) {
            ready = true;
            console.log("ready");
            socket.emit('ready');
          }

          const hitPose = hitTestResults[0].getPose(referenceSpace);
          reticle.visible = true;
          reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
          reticle.updateMatrixWorld(true);

        }
        camera.updateMatrixWorld(true);

        // Render the scene with THREE.WebGLRenderer.
        renderer.render(scene, camera)
        
        
        socket.emit('phone video', imgData);
      }
    }
    session.requestAnimationFrame(onXRFrame);
    console.log("XR session started");
  }

}
else {
  console.log("no webxr")
  var saveFile = function (strData :string, filename : string) {
    var link = document.createElement('a');
    if (typeof link.download === 'string') {
      document.body.appendChild(link); //Firefox requires the link to be in the body
      link.download = filename;
      link.href = strData;
      link.innerText = "download";
      //link.click();
      //document.body.removeChild(link); //remove the link when done
    };
  } 
  //get image element with id 'video'
  var video_elm = document.getElementById("video") as HTMLImageElement;
  socket.on('computer video', data => {
    console.log("recived video");
    video_elm.src = data;
    //saveFile(data.replace("image/jpeg", "image/octet-stream"), "test.jpg");
  });

  document.addEventListener('DOMContentLoaded', function () {
    const button = document.getElementById("xr")!;
    button.innerText = "Connect to video stream"
  });
  
};