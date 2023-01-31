import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FontLoader, Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry }  from 'three/examples/jsm/geometries/TextGeometry.js';

function get_ray(x : number, y : number, view : any) : THREE.Vector3
{
    let vec4 = new THREE.Vector4(x, -y, 0.5, 1.0);
    let projection: THREE.Matrix4 = new THREE.Matrix4();
    let viewmat: THREE.Matrix4 = new THREE.Matrix4();
    projection.fromArray(view.projectionMatrix);
    viewmat.fromArray(view.transform.inverse.matrix);
    projection.multiply(viewmat).invert();
    vec4.applyMatrix4(projection);

    let vec = new THREE.Vector3(vec4.x / vec4.w, vec4.y / vec4.w, vec4.z / vec4.w);

    vec.sub(view.transform.position).normalize();

    return vec;
    
}

function unproject(x : number, y : number, view : any, depthInMeters : number) : THREE.Vector3
{
    let vec4 = new THREE.Vector4(x, -y, 0.5, 1.0);
    let projection: THREE.Matrix4 = new THREE.Matrix4();
    let viewmat: THREE.Matrix4 = new THREE.Matrix4();
    projection.fromArray(view.projectionMatrix);
    viewmat.fromArray(view.transform.inverse.matrix);
    projection.multiply(viewmat).invert();
    vec4.applyMatrix4(projection);

    let vec = new THREE.Vector3(vec4.x / vec4.w, vec4.y / vec4.w, vec4.z / vec4.w);

    vec.sub(view.transform.position).normalize();

    let distance = depthInMeters

    let res = new THREE.Vector3;

    return res.copy(view.transform.position).add(vec.multiplyScalar(distance));
}


let remote_place_object : boolean = false;
let remote_x : number = 0
let remote_y : number = 0

export function place_object(x_input : number, y_input : number)
{
    remote_place_object = true;
    remote_x = x_input;
    remote_y = y_input;
    remote_text = "";
}

let remote_text : string = "";

export function place_text(x_input : number, y_input : number, text : string)
{
    remote_place_object = true;
    remote_x = x_input;
    remote_y = y_input;
    remote_text = text;
}

let measure_points : Array<number> = [];
let measure_texts : Array<number> = [];
let measure_lines : Array<number> = [];
const line_material = new THREE.LineBasicMaterial( { color: 0x0000ff, linewidth: 20 } );

let add_measure_point : boolean = false;

export function add_measure(x_input : number, y_input : number)
{
    console.log("add_measure");
    add_measure_point = true;
    remote_x = x_input;
    remote_y = y_input;
}

let selected_object : THREE.Object3D | null = null;
let is_finger_down : boolean = false;
let x : number = 0;
let y : number = 0;


export async function activateAR() {
    // Add a canvas element and initialize a WebGL context that is compatible with WebXR.
    const loader = new GLTFLoader();
    const font_loader = new FontLoader();

    const scene = new THREE.Scene();
    let reticle: any;
    loader.load("https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", function (gltf) {
        reticle = gltf.scene;
        reticle.visible = false;
        scene.add(reticle);
    })

    
    const small_ball_geometry = new THREE.SphereGeometry(0.025, 32, 32);
    const ball_geometry = new THREE.SphereGeometry(0.05, 32, 32);
    const red_material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

    const yellow_material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(ball_geometry, red_material);
                

    const circle_geometry = new THREE.CircleGeometry(0.05, 32);
    const circle_material = new THREE.MeshBasicMaterial({ color: 0x16d94a });
    const circle = new THREE.Mesh(circle_geometry, circle_material);

    const canvas = document.createElement("canvas");

    let ready = false;
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
    camera.matrixWorldAutoUpdate = false;

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
        remote_place_object = true;
    });*/
    

    session.addEventListener("selectstart", async (event : any) => {
        x = event.inputSource.gamepad!.axes[0];
        y = event.inputSource.gamepad!.axes[1];

        is_finger_down = true;
    });

    session.addEventListener("selectend", async (event : any) => {
        x = event.inputSource.gamepad!.axes[0];
        y = event.inputSource.gamepad!.axes[1];
        is_finger_down = false;

        // check if selected object is in measure_points
        console.log("selected_object: ", selected_object);
        console.log("measure_points: ", measure_points);
        if (selected_object && measure_points.length > 1)
        {
            let index = measure_points.indexOf(selected_object.id);
            console.log("index: ", index);
            if (index > -1)
            {
                console.log("index: ", index);
                console.log("measure_points.length: ", measure_points.length);
                console.log("measure_obj: ", measure_points[index]);
                console.log("measure_obj 2: ", measure_points[index + 1]);
                if (index < measure_points.length - 1) {
                    let text_obj = scene.getObjectById(measure_texts[index])! as THREE.Mesh;
                    let line = scene.getObjectById(measure_lines[index])! as THREE.Line;
                    let pt1 = scene.getObjectById(measure_points[index])!;
                    let pt2 = scene.getObjectById(measure_points[index + 1])!;
                    let distance_between_points = pt1.position.distanceTo(pt2.position);
                    line.geometry = new THREE.BufferGeometry().setFromPoints([pt1.position, pt2.position]);
                    font_loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font: Font) {
                        const text_geometry = new TextGeometry(parseFloat(distance_between_points.toFixed(2)) + "m", {
                            font: font,
                            size: 0.05,
                            height: 0.01,
                            curveSegments: 12,
                            bevelEnabled: true,
                            bevelThickness: 0.001,
                            bevelSize: 0.001,
                            bevelOffset: 0,
                            bevelSegments: 5
                        });
                        text_obj.geometry = text_geometry;
                        text_obj.position.set((pt1.position.x + pt2.position.x) / 2, (pt1.position.y + pt2.position.y) / 2, (pt1.position.z + pt2.position.z) / 2);
                        text_obj.lookAt(camera.position);
                    });
                }

                if (index > 0)
                {
                    index -=1;
                    let text_obj = scene.getObjectById(measure_texts[index])! as THREE.Mesh;
                    let line = scene.getObjectById(measure_lines[index])! as THREE.Line;
                    let pt1 = scene.getObjectById(measure_points[index])!;
                    let pt2 = scene.getObjectById(measure_points[index + 1])!;
                    let distance_between_points = pt1.position.distanceTo(pt2.position);
                    line.geometry = new THREE.BufferGeometry().setFromPoints([pt1.position, pt2.position]);
                    font_loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font: Font) {
                        const text_geometry = new TextGeometry(parseFloat(distance_between_points.toFixed(2)) + "m", {
                            font: font,
                            size: 0.05,
                            height: 0.01,
                            curveSegments: 12,
                            bevelEnabled: true,
                            bevelThickness: 0.001,
                            bevelSize: 0.001,
                            bevelOffset: 0,
                            bevelSegments: 5
                        });
                        text_obj.geometry = text_geometry;
                        text_obj.position.set((pt1.position.x + pt2.position.x) / 2, (pt1.position.y + pt2.position.y) / 2, (pt1.position.z + pt2.position.z) / 2);
                        text_obj.lookAt(camera.position);
                    });


                }
            }
        }

        
        selected_object = null;
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
                    //serverConnection.send(JSON.stringify({'ready' : uuid}));
                    document.getElementById("calibrate")!.style.display = "none";
                }

                const hitPose = hitTestResults[0].getPose(referenceSpace);
                reticle.visible = true;
                reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
                reticle.quaternion.set(hitPose.transform.orientation.x, hitPose.transform.orientation.y, hitPose.transform.orientation.z, hitPose.transform.orientation.w)
                reticle.updateMatrixWorld(true);
            }

            if (is_finger_down && !selected_object) {
                let origin = new THREE.Vector3(view.transform.position.x, view.transform.position.y, view.transform.position.z);
                let raycaster = new THREE.Raycaster(origin, get_ray(x, y, view));
                let intersects = raycaster.intersectObjects(scene.children);
                if (intersects.length > 0) {
                    selected_object = intersects[0].object;

                    if (measure_lines.includes(selected_object.id))
                        selected_object = null
                    console.log("got an object :", selected_object);
                }
                else
                {
                    const depthInfo = frame.getDepthInformation(view);
                    const depthInMeters = depthInfo.getDepthInMeters((remote_x + 1) / 2, (remote_y + 1) / 2);
                    let pos = unproject(remote_x, remote_y, view, depthInMeters);
                    let new_sphere = sphere.clone();
                    new_sphere.position.copy(pos)

                    scene.add(new_sphere);
                    selected_object = new_sphere;
                }
            }

            if (selected_object) {

                let hitTestResultsPerInputSource = frame.getHitTestResultsForTransientInput(transientInputHitTestSource);

                if (hitTestResultsPerInputSource.length > 0 && reticle) {
                    let hitTestResult = hitTestResultsPerInputSource[0];
                    let hitTestResults = hitTestResult.results;
                    if (hitTestResults.length > 0) {
                        let hitPose = hitTestResults[0].getPose(referenceSpace);

                        selected_object.position.copy(hitPose.transform.position);
                    }
                }
            }
            
            if (remote_place_object)
            {
                remote_place_object = false;
                
                const depthInfo = frame.getDepthInformation(view);
                const depthInMeters = depthInfo.getDepthInMeters((remote_x + 1) / 2, (remote_y + 1) / 2);

                let pos = unproject(remote_x, remote_y, view, depthInMeters);

                if (remote_text == "")
                {
                    let new_sphere = sphere.clone();
                    new_sphere.position.copy(pos)

                    scene.add(new_sphere);
                }
                else
                {
                    font_loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font: Font) {
                        const text_geometry = new TextGeometry(remote_text, {
                            font: font,
                            size: 0.05,
                            height: 0.01,
                            curveSegments: 12,
                            bevelEnabled: true,
                            bevelThickness: 0.001,
                            bevelSize: 0.001,
                            bevelOffset: 0,
                            bevelSegments: 5
                        });
                        const text_material = new THREE.MeshBasicMaterial({ color: 0x2cb04f});
                        const text_mesh = new THREE.Mesh(text_geometry, text_material);
                        text_mesh.position.set(pos.x, pos.y, pos.z);
                        text_mesh.lookAt(camera.position);
                        scene.add(text_mesh);
                    });
                }
            }

            if (add_measure_point)
            {
                add_measure_point = false;
                const depthInfo = frame.getDepthInformation(view);
                const depthInMeters = depthInfo.getDepthInMeters((remote_x + 1) / 2, (remote_y + 1) / 2);

                let pos  = unproject(remote_x, remote_y, view, depthInMeters);

                if (measure_points.length > 0)
                {
                    // make array of type Vector3
                    let pts  : THREE.Vector3[] = [];
                    pts.push(scene.getObjectById(measure_points[measure_points.length - 1])!.position.clone());
                    pts.push(pos.clone());

                    const geometry = new THREE.BufferGeometry().setFromPoints(pts);

                    const line = new THREE.Line(geometry, line_material);

                    measure_lines.push(line.id);
                    scene.add(line);

                    let distance_between_points : number = scene.getObjectById(measure_points[measure_points.length - 1])!.position.distanceTo(pos);
                    font_loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function (font: Font) {
                        const text_geometry = new TextGeometry( parseFloat(distance_between_points.toFixed(2)) + "m", {
                            font: font,
                            size: 0.05,
                            height: 0.01,
                            curveSegments: 12,
                            bevelEnabled: true,
                            bevelThickness: 0.001,
                            bevelSize: 0.001,
                            bevelOffset: 0,
                            bevelSegments: 5
                        });
                        const text_material = new THREE.MeshBasicMaterial({ color: 0x2cb04f });
                        const text_mesh = new THREE.Mesh(text_geometry, text_material);
                        text_mesh.position.set((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, (pts[0].z + pts[1].z) / 2);
                        text_mesh.lookAt(camera.position);
                        measure_texts.push(text_mesh.id);
                        scene.add(text_mesh);
                    });

                }
                
                const new_sphere = new THREE.Mesh(small_ball_geometry, yellow_material);
                
                new_sphere.position.copy(pos)

                measure_points.push(new_sphere.id);
                scene.add(new_sphere);
                
            }

            // @ts-ignore
            var raw_camera_texture = xr_binding.getCameraImage(view.camera)
            camera.updateMatrixWorld(true);

            if (!ready) {
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

            if (!ready) {
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
        }
    }
    session.requestAnimationFrame(onXRFrame);
    console.log("XR session started");
    
    return canvas.captureStream(30)
}