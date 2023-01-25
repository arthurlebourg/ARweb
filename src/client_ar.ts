import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { serverConnection } from './main'
import { uuid } from './main'

import { createApp } from 'vue';
import AROverlay from './AR_overlay.vue';

let remote_place_object : boolean = false;
let x : number = 0
let y : number= 0

export function place_object(x : number, y : number)
{
    remote_place_object = true;
    x = x;
    y = y;
}


function depthSample(linearDepth : number, camera: THREE.PerspectiveCamera)
{
    let nonLinearDepth = (camera.far + camera.near - 2.0 * camera.near * camera.far / linearDepth) / (camera.far - camera.near);
    nonLinearDepth = (nonLinearDepth + 1.0) / 2.0;
    return nonLinearDepth;
}

export async function activateAR() {
    // Add a canvas element and initialize a WebGL context that is compatible with WebXR.

    var ardiv = document.createElement("div")
    ardiv.id = "ar_overlay"
    document.body.appendChild(ardiv)
    createApp(AROverlay).mount('#ar_overlay')!

    document.body.removeChild(document.getElementById("localVideo")!);
    document.body.removeChild(document.getElementById("remoteVideo")!);
    let buttons = document.getElementsByClassName("start_button");
    while (buttons.length > 0) {
        document.body.removeChild(buttons[0]);
    }

    const loader = new GLTFLoader();
    const scene = new THREE.Scene();
    let reticle: any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
        reticle = gltf.scene;
        reticle.visible = false;
        scene.add(reticle);
    })

    const canvas = document.createElement("canvas");
    canvas.addEventListener('pointerdown', console.log);

    let ready = false;
    document.body.appendChild(canvas);
    const xr_context : WebGL2RenderingContext = canvas.getContext("webgl2", { xrCompatible: true, antialias : false})!;

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 15, 10);
    scene.add(directionalLight);

    // Set up the WebGLRenderer, which handles rendering to the session's base layer.
    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        preserveDrawingBuffer: true,
        canvas: canvas,
        context: xr_context
    });
    renderer.autoClear = false;

    const camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = false;

    var overlay = document.getElementById("ar_overlay")!;

    // Initialize a WebXR session using "immersive-ar".
    const session = await navigator.xr!.requestSession("immersive-ar", {
        requiredFeatures: ['hit-test', 'camera-access', 'depth-sensing', 'dom-overlay'],
        domOverlay: {
            root: overlay
        },
        // @ts-ignore
        depthSensing: {
            usagePreference: ["cpu-optimized", "gpu-optimized"],
            dataFormatPreference: ["luminance-alpha", "float32"],
        },
    });

    // @ts-ignore
    console.log(session.depthUsage);
    // @ts-ignore
    console.log(session.depthDataFormat);

    if (session.domOverlayState) {
        document.getElementById("session-info")!.innerHTML =
            "DOM Overlay type: " + session.domOverlayState.type;
    }


    session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, xr_context)
    });
    const xr_binding = new XRWebGLBinding(session, xr_context);

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    const referenceSpace = await session.requestReferenceSpace('local');

    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await session.requestReferenceSpace('viewer');
    // Perform hit testing using the viewer as origin.
    const hitTestSource = await session.requestHitTestSource!({ space: viewerSpace })!;
    let transientInputHitTestSource  = await session.requestHitTestSourceForTransientInput!({ profile: 'generic-touchscreen' })!;

    /*session.addEventListener("select", async (event : any) => {
        x = event.inputSource.gamepad!.axes[0];
        y = event.inputSource.gamepad!.axes[1];
        /*if (reticle) {
            //console.log(event)
            let user_x = event.inputSource.gamepad!.axes[0];
            let user_y = event.inputSource.gamepad!.axes[1];
            console.log(user_x, user_y);
        }* /
    });*/
    

    // Create a render loop that allows us to draw on the AR view.
    const onXRFrame = (time : number, frame : any) => {
        //session.dispatchEvent(new XRInputSourceEvent("select", {}));
        // Queue up the next draw request.
        session.requestAnimationFrame(onXRFrame);


        // Bind the graphics framebuffer to the baseLayer's framebuffer
        xr_context.bindFramebuffer(xr_context.FRAMEBUFFER, session.renderState.baseLayer!.framebuffer)

        // Retrieve the pose of the device.
        // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
        var pose = frame.getViewerPose(referenceSpace);
    
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
            if (hitTestResults.length > 0 && reticle)
            {
                if (!ready) {
                    ready = true;
                    console.log("ready");
                    serverConnection.send(JSON.stringify({'ready' : uuid}));
                    document.getElementById("calibrate")!.style.display = "none";
                }

                const hitPose = hitTestResults[0].getPose(referenceSpace);
                reticle.visible = true;
                reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
                reticle.quaternion.set(hitPose.transform.orientation.x, hitPose.transform.orientation.y, hitPose.transform.orientation.z, hitPose.transform.orientation.w)
                reticle.updateMatrixWorld(true);
            }
            
            let hitTestResultsPerInputSource = frame.getHitTestResultsForTransientInput(transientInputHitTestSource);

            if (hitTestResultsPerInputSource.length > 0 && reticle) {
                let hitTestResult = hitTestResultsPerInputSource[0];
                let hitTestResults = hitTestResult.results;
                if (hitTestResults.length > 0) {
                    let hitPose = hitTestResults[0].getPose(referenceSpace);
                    const clone = reticle.clone();
                    clone.position.copy(hitPose.transform.position);

                    clone.quaternion.copy(hitPose.transform.orientation);

                    scene.add(clone);
                    
                }
            }
            

            if (remote_place_object)
            {
                const depthInfo = frame.getDepthInformation(view);
                const depthInMeters = depthInfo.getDepthInMeters(x, y);

                console.log("depth : " + depthInMeters);

                let projectionMatrix = camera.projectionMatrix;

                let A = projectionMatrix.elements[10];
                let B = projectionMatrix.elements[11];

                let depth = 0.5 * (-A * depthInMeters + B) / depthInMeters + 0.5;

                //let depth = depthSample(depthInMeters, camera)
                //console.log("depth : " + depth);
                //console.log("depth : " + depthInMeters);

                // create a three js box of color green
                const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const testclone = new THREE.Mesh(geometry, material);
                let pos = new THREE.Vector3(x, y, depth);
                pos.unproject(camera);
                testclone.position.copy(pos);
                scene.add(testclone);

                remote_place_object = false;

            }

            // @ts-ignore
            var raw_camera_texture = xr_binding.getCameraImage(view.camera)
            camera.updateMatrixWorld(true);

            if (!ready) {
                console.log("not ready");
                const width = session.renderState.baseLayer!.framebufferWidth;
                const height = session.renderState.baseLayer!.framebufferHeight;
                xr_context.enable(xr_context.SCISSOR_TEST);
                xr_context.scissor(width / 4, height / 4, width / 2, height / 2);
                xr_context.clearColor(0.5, 0.0, 0.0, 0.5);
                xr_context.clear(xr_context.COLOR_BUFFER_BIT | xr_context.DEPTH_BUFFER_BIT);
                xr_context.disable(xr_context.SCISSOR_TEST);
            }
            else {
                // Render the scene with THREE.WebGLRenderer.
                renderer.render(scene, camera)
            }

            // render the scene with raw camera texture as backaground to CPU canvas
            xr_context.bindFramebuffer(xr_context.FRAMEBUFFER, null);

            xr_context.clear(xr_context.COLOR_BUFFER_BIT | xr_context.DEPTH_BUFFER_BIT);
            
            scene.background = new THREE.Texture(raw_camera_texture);
            
            xr_context.viewport(0, 0, xr_context.drawingBufferWidth, xr_context.drawingBufferHeight);

            renderer.render(scene, camera);
        }
    }
    session.requestAnimationFrame(onXRFrame);
    console.log("XR session started");
    
    return canvas.captureStream(30)
}