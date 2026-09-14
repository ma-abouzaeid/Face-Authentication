const MODEL_URL = '#APP_FILES#models/';

let faceLoginStream = null;
let faceLoginRunning = false;
let faceLoginVerifying = false;

console.log("Face API:", typeof faceapi);

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
])
    .then(function () {

        console.log("✅ Tiny Face Detector loaded");
        console.log("✅ Tiny Face Landmark 68 loaded");
        console.log("✅ Face Recognition loaded");

    })
    .catch(function (error) {

        console.error("❌ Face model loading failed:", error);

    });


window.startFaceLoginCamera = async function () {

    const video =
        document.getElementById("faceLoginVideo");

    const status =
        document.getElementById("faceLoginStatus");

    if (!video) {
        console.error("❌ faceLoginVideo not found");
        return;
    }

    try {

        if (faceLoginStream) {
            faceLoginStream
                .getTracks()
                .forEach(function (track) {
                    track.stop();
                });
        }

        faceLoginStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "user",
                    width: {
                        ideal: 640
                    },
                    height: {
                        ideal: 480
                    }
                },
                audio: false
            });

        video.srcObject = faceLoginStream;

        await video.play();

        faceLoginRunning = true;

        if (status) {
            status.textContent =
                "Camera ready. Look at the camera.";
        }

        console.log("✅ Face login camera started");

        detectFaceLogin();

    } catch (error) {

        console.error(
            "❌ Camera error:",
            error
        );

        if (status) {
            status.textContent =
                "Unable to access the camera.";
        }

    }

};


async function detectFaceLogin() {

    const video =
        document.getElementById("faceLoginVideo");

    const status =
        document.getElementById("faceLoginStatus");

    if (!video || !faceLoginRunning) {
        return;
    }

    if (video.readyState >= 2) {

        try {

            const detection =
                await faceapi
                    .detectSingleFace(
                        video,
                        new faceapi.TinyFaceDetectorOptions({
                            inputSize: 416,
                            scoreThreshold: 0.35
                        })
                    )
                    .withFaceLandmarks(true)
                    .withFaceDescriptor();

            if (detection) {

                status.textContent =
                    "Face detected. Verifying...";

                /*
                 * Prevent multiple Ajax requests
                 */
                if (!faceLoginVerifying) {

                    faceLoginVerifying = true;

                    const descriptor =
                        Array.from(detection.descriptor);

                    const identifier =
                        apex.item("P9999_USERNAME")
                            .getValue()
                            .trim();

                    console.log(
                        "✅ Face descriptor generated",
                        "Length:",
                        descriptor.length
                    );

                    verifyFaceLogin(
                        identifier,
                        descriptor
                    );
                }

            } else {

                status.textContent =
                    "Looking for your face...";

            }

        } catch (error) {

            console.error(
                "❌ Face detection error:",
                error
            );

        }

    }

    requestAnimationFrame(
        detectFaceLogin
    );
}
async function verifyFaceLogin(identifier, descriptor) {

    const status =
        document.getElementById("faceLoginStatus");

    try {

        console.log("🔐 Sending face verification...");

        apex.server.process(
            "VERIFY_FACE_LOGIN",
            {
                x01: identifier,
                x02: JSON.stringify(descriptor)
            },
            {
                /*
                 * POST_LOGIN may return an APEX HTML page
                 * after successful authentication.
                 */
                dataType: "text",

                success: function (response) {

                    console.log(
                        "🔐 Face verification response received."
                    );

                    /*
                     * Successful POST_LOGIN may return HTML.
                     * Redirect immediately.
                     */
                    if (
                        typeof response === "string" &&
                        response.toLowerCase().indexOf("<!doctype html") !== -1
                    ) {

                        console.log(
                            "✅ APEX authentication successful."
                        );

                        status.textContent =
                            "✅ Face verified. Logging you in...";

                        stopFaceLoginCamera();

                        setTimeout(function () {

                            apex.navigation.redirect(
                                "f?p=" +
                                $v("pFlowId") +
                                ":1:" +
                                $v("pInstance")
                            );

                        }, 300);

                        return;
                    }


                    /*
                     * Parse JSON response
                     */
                    let data;

                    try {

                        data = JSON.parse(response);

                    } catch (parseError) {

                        console.error(
                            "❌ Invalid server response:",
                            response
                        );

                        apex.message.alert(
                            "An unexpected error occurred during face verification."
                        );

                        faceLoginVerifying = false;

                        return;
                    }


                    console.log(
                        "🔐 Verification result:",
                        data
                    );


                    /*
                     * User does not exist
                     */
                    if (data.status === "USER_NOT_FOUND") {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            "User not found.\n\n" +
                            "Please enter a valid Username or Email.",
                            function () {

                                faceLoginVerifying = false;

                                const usernameItem =
                                    apex.item("P9999_USERNAME");

                                usernameItem.setFocus();

                            }
                        );

                        return;
                    }


                    /*
                     * No face profile
                     */
                    if (data.status === "NO_FACE_PROFILE") {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            "Face ID is not registered for this user.",
                            function () {

                                faceLoginVerifying = false;

                            }
                        );

                        return;
                    }


                    /*
                     * No face samples
                     */
                    if (data.status === "NO_FACE_SAMPLES") {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            "No Face ID samples are registered for this user.",
                            function () {

                                faceLoginVerifying = false;

                            }
                        );

                        return;
                    }


                    /*
                     * Face does not match
                     */
                    if (
                        data.status === "NO_MATCH"
                    ) {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            "Face not recognized.\n\n" +
                            "The face does not match the registered Face ID.",
                            function () {

                                faceLoginVerifying = false;

                            }
                        );

                        return;
                    }


                    /*
                     * Invalid descriptor
                     */
                    if (
                        data.status === "INVALID_DESCRIPTOR"
                    ) {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            "Unable to verify your face.\n\n" +
                            "Please try again.",
                            function () {

                                faceLoginVerifying = false;

                            }
                        );

                        return;
                    }


                    /*
                     * Descriptor missing
                     */
                    if (
                        data.status === "DESCRIPTOR_REQUIRED"
                    ) {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            "Face verification could not start.",
                            function () {

                                faceLoginVerifying = false;

                            }
                        );

                        return;
                    }


                    /*
                     * Username missing
                     */
                    if (
                        data.status === "USERNAME_REQUIRED"
                    ) {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            "Please enter your Username or Email first.",
                            function () {

                                faceLoginVerifying = false;

                            }
                        );

                        return;
                    }


                    /*
                     * General server error
                     */
                    if (
                        data.status === "ERROR"
                    ) {

                        stopFaceLoginCamera();

                        apex.message.alert(
                            data.message ||
                            "An error occurred during face verification.",
                            function () {

                                faceLoginVerifying = false;

                            }
                        );

                        return;
                    }


                    /*
                     * Unexpected response
                     */
                    apex.message.alert(
                        data.message ||
                        "Face verification failed.",
                        function () {

                            faceLoginVerifying = false;

                        }
                    );
                },


                error: function (
                    jqXHR,
                    textStatus,
                    errorThrown
                ) {

                    console.error(
                        "❌ Face verification Ajax error:",
                        textStatus,
                        errorThrown
                    );

                    console.error(
                        "Response:",
                        jqXHR.responseText
                    );

                    status.textContent =
                        "Verification failed. Please try again.";

                    faceLoginVerifying = false;
                }
            }
        );

    } catch (error) {

        console.error(
            "❌ Verification error:",
            error
        );

        status.textContent =
            "Verification failed.";

        faceLoginVerifying = false;
    }
}

window.stopFaceLoginCamera = function () {

    faceLoginRunning = false;

    if (faceLoginStream) {

        faceLoginStream
            .getTracks()
            .forEach(function (track) {
                track.stop();
            });

        faceLoginStream = null;
    }

    const video =
        document.getElementById("faceLoginVideo");

    if (video) {
        video.srcObject = null;
    }

    console.log(
        "🛑 Face login camera stopped"
    );

};

/*============================*/
setTimeout(function () {

    const video = document.getElementById("faceLoginVideo");

    if (video) {
        video.style.display = "block";
        video.style.width = "100%";
        video.style.height = "auto";
        video.style.minHeight = "300px";
        video.style.objectFit = "cover";
        video.style.background = "#000";
    }

}, 1000);