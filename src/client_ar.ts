import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { serverConnection } from './main'
import { uuid } from './main'

export async function activateAR() {
    // Add a canvas element and initialize a WebGL context that is compatible with WebXR.
    const loader = new GLTFLoader();
    var ready = false;
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    const xr_context = canvas.getContext("webgl", { xrCompatible: true })!;

    var cam_width = 1280;
    var cam_height = 720;

    var off_screen_canvas = document.createElement('canvas');
    var off_screen_context = off_screen_canvas.getContext('2d')!;

    // Create a 2D canvas to store the result 
    // function createImageFromTexture(gl : any, texture : any, width : number, height : number) {
    //     // Create a framebuffer backed by the texture
    //     gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    //     gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    //     var data_truc = new Uint8Array(width * height * 4);
    //     canvas_truc.width = width;
    //     canvas_truc.height = height;
    //     var context_truc = canvas_truc.getContext('2d')!;
    //     var imageData = context_truc.createImageData(width, height);

    //     // Read the contents of the framebuffer
    //     gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data_truc);

    //     // Copy the pixels to a 2D canvas
    //     imageData.data.set(data_truc);
    //     context_truc.putImageData(imageData, 0, 0);

    //     serverConnection.send(JSON.stringify({"video_info" :canvas_truc.toDataURL()}));
    //     //socket.emit("phone video", canvas_truc.toDataURL());
    // }

    // To be continued in upcoming steps.
    const scene = new THREE.Scene();

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
    const session = await navigator.xr!.requestSession("immersive-ar", { requiredFeatures: ['hit-test', 'anchors', 'camera-access'] })!;
    session.updateRenderState({
        baseLayer: new XRWebGLLayer(session, xr_context)
    });
    const glBinding = new XRWebGLBinding(session, xr_context);

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    const referenceSpace = await session.requestReferenceSpace('local');

    let reticle : any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
        reticle = gltf.scene;
        reticle.visible = false;
        scene.add(reticle);
    })

    let flower : any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf", function (gltf) {
        flower = gltf.scene;
    });

    session.addEventListener("select", (event) => {
        if (flower) {
            const hitTestResults = event.frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0 && reticle) {
                const hitPose = hitTestResults[0].getPose(referenceSpace);
                const clone = flower.clone();
                clone.position.copy(reticle.position);
                clone.quaternion.copy(reticle.quaternion);

                scene.add(clone);
            }
        }
    });

    // A 'local' reference space has a native origin that is located
    // near the viewer's position at the time the session was created.
    // Create another XRReferenceSpace that has the viewer as the origin.
    const viewerSpace = await session.requestReferenceSpace('viewer');
    // Perform hit testing using the viewer as origin.
    const hitTestSource = await session.requestHitTestSource!({ space: viewerSpace })!;

    // Create a render loop that allows us to draw on the AR view.
    const onXRFrame = (time : number, frame : any) => {
        // Queue up the next draw request.
        session.requestAnimationFrame(onXRFrame);

        // Bind the graphics framebuffer to the baseLayer's framebuffer
        xr_context.bindFramebuffer(xr_context.FRAMEBUFFER, session.renderState.baseLayer!.framebuffer)

        // Retrieve the pose of the device.
        // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
        const pose = frame.getViewerPose(referenceSpace);
        if (pose) {
            // In mobile AR, we only have one view.
            const view = pose.views[0];
            cam_width = view.camera.width;
            cam_height = view.camera.height;

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
                    serverConnection.send(JSON.stringify({'ready' : uuid}));
                }

                const hitPose = hitTestResults[0].getPose(referenceSpace);
                reticle.visible = true;
                reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
                reticle.updateMatrixWorld(true);

                // take raw camera picture
                // @ts-ignore
                var camBinding = glBinding.getCameraImage(view.camera)
                //createImageFromTexture(gl, camBinding, view.camera.width / 4, view.camera.height / 4)

                let off_screen_framebuffer = xr_context.createFramebuffer();
                xr_context.bindFramebuffer(xr_context.FRAMEBUFFER, off_screen_framebuffer);

                xr_context.framebufferTexture2D(xr_context.FRAMEBUFFER, xr_context.COLOR_ATTACHMENT0, xr_context.TEXTURE_2D, camBinding, 0);
                var data_off_screen = new Uint8Array(cam_width * cam_height * 4);
                var off_screen_image = off_screen_context.createImageData(cam_width, cam_height);

                xr_context.readPixels(0, 0, cam_width, cam_height, xr_context.RGBA, xr_context.UNSIGNED_BYTE, data_off_screen);
                off_screen_image.data.set(data_off_screen);
                off_screen_context.putImageData(off_screen_image, 0, 0);

                xr_context.bindFramebuffer(xr_context.FRAMEBUFFER, session.renderState.baseLayer!.framebuffer)

            }
            camera.updateMatrixWorld(true);

            // Render the scene with THREE.WebGLRenderer.
            renderer.render(scene, camera)
        }
    }
    session.requestAnimationFrame(onXRFrame);
    console.log("XR session started");
    
    return off_screen_canvas.captureStream(30)
}