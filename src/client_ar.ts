import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { serverConnection } from './main'
import { uuid } from './main'

export const canvas = document.createElement("canvas");

export async function activateAR() {
    // Add a canvas element and initialize a WebGL context that is compatible with WebXR.

    const loader = new GLTFLoader();
    const scene = new THREE.Scene();
    let reticle: any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
        reticle = gltf.scene;
        reticle.visible = false;
        scene.add(reticle);
    })

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
    // Initialize a WebXR session using "immersive-ar".
    const session = await navigator.xr!.requestSession("immersive-ar", {
        requiredFeatures: ['hit-test', 'anchors', 'camera-access'],
    });


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

    let x = 0
    let y = 0

    session.addEventListener("select", async (event : any) => {
        x = event.inputSource.gamepad!.axes[0];
        y = event.inputSource.gamepad!.axes[1];
        /*if (reticle) {
            //console.log(event)
            let user_x = event.inputSource.gamepad!.axes[0];
            let user_y = event.inputSource.gamepad!.axes[1];
            console.log(user_x, user_y);
        }*/
    });
    

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

            //const depthInfo = frame.getDepthInformation(view);
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
                    //console.log(hitPose.transform.position);
                    //const depthInMeters = depthInfo.getDepthInMeters(x, y);
                    //console.log("depth : " + depthInMeters);
                    clone.quaternion.copy(hitPose.transform.orientation);

                    scene.add(clone);
                }
            }

            // @ts-ignore
            var raw_camera_texture = xr_binding.getCameraImage(view.camera)
            camera.updateMatrixWorld(true);

            // Render the scene with THREE.WebGLRenderer.
            renderer.render(scene, camera)

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